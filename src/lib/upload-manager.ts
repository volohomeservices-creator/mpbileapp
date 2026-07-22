import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { apiClient } from '@/api/client';
import { monitor } from './monitor';
import { MOBILE_CONFIG } from './mobile-config';
import { offlineSyncManager, QueuePriority } from './offline-sync';

export interface UploadProgressCallback {
  (progress: number): void;
}

class UploadManager {
  /**
   * Requests media and camera permissions.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    
    try {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      return (
        cameraStatus.status === ImagePicker.PermissionStatus.GRANTED &&
        libraryStatus.status === ImagePicker.PermissionStatus.GRANTED
      );
    } catch (err) {
      monitor.error('[Upload Manager] Failed to request permissions', err);
      return false;
    }
  }

  /**
   * Compresses and resizes an image to keep storage footprint and upload bandwidth low.
   * Maximum width: 1280px, JPEG quality: 80%.
   */
  async compressImage(uri: string): Promise<string> {
    try {
      monitor.info('[Upload Manager] Commencing image compression...', { uri });
      
      // Calculate actions (resize to max width of 1280px, preserving aspect ratio)
      const actions: ImageManipulator.Action[] = [
        {
          resize: {
            width: MOBILE_CONFIG.UPLOAD_MAX_WIDTH,
          },
        },
      ];

      const saveOptions: ImageManipulator.SaveOptions = {
        compress: MOBILE_CONFIG.UPLOAD_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      };

      const result = await ImageManipulator.manipulateAsync(uri, actions, saveOptions);
      monitor.info('[Upload Manager] Compression successful.', {
        originalUri: uri,
        compressedUri: result.uri,
        width: result.width,
        height: result.height,
      });

      return result.uri;
    } catch (err) {
      monitor.error('[Upload Manager] Image compression failed, falling back to original image.', err);
      return uri; // fallback to original uri
    }
  }

  /**
   * Performs image upload to the backend endpoint with progress callbacks and offline fallback queueing.
   */
  async uploadFile(
    uploadUrl: string,
    fileUri: string,
    fieldName = 'file',
    onProgress?: UploadProgressCallback
  ): Promise<{ success: boolean; data?: any }> {
    try {
      // 1. Compress the target image
      const compressedUri = await this.compressImage(fileUri);

      // 2. Prepare multipart request data
      const formData = new FormData();
      const filename = compressedUri.split('/').pop() || 'upload.jpg';
      
      // Construct file details for React Native Form Data
      const fileData = {
        uri: Platform.OS === 'ios' ? compressedUri.replace('file://', '') : compressedUri,
        type: 'image/jpeg',
        name: filename,
      };
      
      formData.append(fieldName, fileData as any);

      monitor.info(`[Upload Manager] Uploading file to ${uploadUrl}...`);

      const response = await apiClient.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Extend timeout for large uploads
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });

      return { success: true, data: response.data };
    } catch (err: any) {
      monitor.logUploadFailure(fileUri, err);
      
      // If network failure, queue the upload in offline sync manager
      const isNetworkError = !err.response || err.code === 'ECONNABORTED';
      if (isNetworkError) {
        monitor.warn('[Upload Manager] Network failure detected. Enqueuing file upload to offline queue.');
        await offlineSyncManager.enqueue(uploadUrl, 'POST', { fileUri, fieldName }, QueuePriority.MEDIUM);
        return { success: false };
      }

      throw err;
    }
  }
}

export const uploadManager = new UploadManager();
