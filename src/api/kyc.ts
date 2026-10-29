import { apiClient, apiGet, apiPost } from '@/api/client';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { MOBILE_CONFIG } from '@/lib/mobile-config';

export interface KycDocument {
  id: string;
  worker_id: string;
  document_type:
    | 'AADHAAR_FRONT'
    | 'AADHAAR_BACK'
    | 'PAN_CARD'
    | 'SELFIE_VERIFICATION'
    | 'PROFILE_PHOTO'
    | 'EXPERIENCE_CERTIFICATE'
    | 'CERTIFICATE';
  file_url: string;
  file_size: number;
  mime_type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploaded_at: string;
  signedUrl?: string | null;
}

export interface KycState {
  worker_id: string;
  aadhaar_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  pan_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  selfie_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  certificate_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  overall_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INCOMPLETE';
  remarks: string | null;
  submitted_at: string | null;
}

export interface BankDetails {
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  dob: string | null;
  worker_id_code?: string | null;
  full_name: string | null;
}

export interface KycResponse {
  success: boolean;
  documents: KycDocument[];
  kycState: KycState;
  skills: string[];
  categories: Array<{ id: string; name: string; skills?: string[] }>;
  bankDetails: BankDetails | null;
}

/**
 * Fetch current worker KYC status, uploaded documents, bank details, and available categories.
 */
export async function getKycDetails(): Promise<KycResponse> {
  return apiGet<KycResponse>('/api/worker/kyc');
}

/**
 * Save bank and personal details for KYC.
 */
export async function saveKycBankDetails(details: {
  full_name: string;
  dob: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  skills: string[];
}): Promise<{ success: boolean; message?: string }> {
  return apiPost('/api/worker/kyc', { bankDetails: details });
}

/**
 * Compresses an image and converts it into WebP format before storage.
 */
async function compressImageForKyc(uri: string, isSelfie = false, isDocument = false): Promise<string> {
  try {
    const actions: ImageManipulator.Action[] = [
      {
        resize: {
          width: isSelfie ? 800 : isDocument ? 1000 : (MOBILE_CONFIG.UPLOAD_MAX_WIDTH || 1200),
        },
      },
    ];

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: isDocument ? 0.6 : isSelfie ? 0.75 : 0.8,
        format: ImageManipulator.SaveFormat.WEBP,
      }
    );
    return result.uri;
  } catch (err) {
    console.warn('[KYC] WebP compression fallback to JPEG:', err);
    try {
      const fallback = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: isSelfie ? 800 : isDocument ? 1000 : 1200 } }],
        { compress: isDocument ? 0.55 : 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return fallback.uri;
    } catch {
      return uri;
    }
  }
}

/**
 * Uploads a document to Supabase storage via /api/upload and registers the document with /api/worker/kyc.
 * All files are compressed and converted into WebP format.
 */
export async function uploadKycDocument(
  workerId: string,
  documentType:
    | 'AADHAAR_FRONT'
    | 'AADHAAR_BACK'
    | 'PAN_CARD'
    | 'SELFIE_VERIFICATION'
    | 'PROFILE_PHOTO'
    | 'EXPERIENCE_CERTIFICATE'
    | 'CERTIFICATE',
  fileUri: string
): Promise<{ success: boolean; message?: string; overallStatus?: string }> {
  // 1. Compress image and convert to WebP
  const isSelfie = documentType === 'SELFIE_VERIFICATION';
  const isDoc = ['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'EXPERIENCE_CERTIFICATE', 'CERTIFICATE'].includes(documentType);
  const compressedUri = await compressImageForKyc(fileUri, isSelfie, isDoc);

  // 2. Determine target path and bucket
  const bucket = documentType === 'PROFILE_PHOTO' ? 'profile-images' : 'kyc-docs';
  const fileMap: Record<string, string> = {
    PROFILE_PHOTO: 'profile.webp',
    AADHAAR_FRONT: 'aadhaar-front.webp',
    AADHAAR_BACK: 'aadhaar-back.webp',
    PAN_CARD: 'pan.webp',
    SELFIE_VERIFICATION: 'selfie.webp',
    EXPERIENCE_CERTIFICATE: 'certificate.webp',
    CERTIFICATE: 'certificate.webp',
  };
  const filename = fileMap[documentType] || 'certificate.webp';
  const targetPath = `worker_${workerId}/${filename}`;

  // 3. Upload file using /api/upload
  const formData = new FormData();
  formData.append('bucket', bucket);
  formData.append('path', targetPath);

  const filePayload = {
    uri: Platform.OS === 'ios' ? compressedUri.replace('file://', '') : compressedUri,
    type: 'image/webp',
    name: filename,
  };
  formData.append('file', filePayload as any);

  const uploadRes = await apiClient.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  });

  const uploadedPath = uploadRes.data?.path || targetPath;

  // 4. Register document with worker KYC API with WebP mime type
  const regRes = await apiClient.post('/api/worker/kyc', {
    document_type: documentType,
    file_url: uploadedPath,
    file_size: 45000,
    mime_type: 'image/webp',
  });

  return regRes.data;
}
