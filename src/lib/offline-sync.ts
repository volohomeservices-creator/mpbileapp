import { Platform } from 'react-native';
import { storage } from '@/utils/storage';
import { apiClient } from '@/api/client';
import { monitor } from './monitor';
import { MOBILE_CONFIG } from './mobile-config';

export enum QueuePriority {
  HIGHEST = 3,  // Booking mutations
  MEDIUM = 2,   // Image uploads / Profiles
  LOWEST = 1,   // GPS telemetries
}

export interface QueuedRequest {
  uuid: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
  priority: QueuePriority;
  timestamp: number;
  retryCount: number;
  idempotencyKey: string;
}

const QUEUE_STORAGE_KEY = 'volo_offline_sync_queue';

class OfflineSyncManager {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private isOnline = true;
  private syncTimer: any = null;

  constructor() {
    this.loadQueue();
    this.startConnectionCheck();
  }

  private async loadQueue() {
    try {
      const data = await storage.getItem(QUEUE_STORAGE_KEY);
      if (data) {
        this.queue = JSON.parse(data);
        monitor.info(`[Offline Sync] Loaded ${this.queue.length} items from persistent queue.`);
        this.triggerProcessing();
      }
    } catch (err) {
      monitor.error('[Offline Sync] Failed to load queue from storage', err);
    }
  }

  private async saveQueue() {
    try {
      await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      monitor.error('[Offline Sync] Failed to save queue to storage', err);
    }
  }

  /**
   * Enqueues a failed request to be processed once online.
   */
  async enqueue(
    url: string,
    method: QueuedRequest['method'],
    data: any,
    priority: QueuePriority = QueuePriority.MEDIUM
  ) {
    const uuid = this.generateUuid();
    const request: QueuedRequest = {
      uuid,
      url,
      method,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      idempotencyKey: uuid, // Use transaction UUID as idempotency key
    };

    // Filter out duplicate GPS telemetry updates to avoid bloating queue
    if (priority === QueuePriority.LOWEST && this.queue.some(r => r.url === url && r.priority === QueuePriority.LOWEST)) {
      // Keep only the latest GPS location update, discard stale ones
      this.queue = this.queue.filter(r => !(r.url === url && r.priority === QueuePriority.LOWEST));
    }

    this.queue.push(request);
    // Sort by priority (Highest first), then by timestamp (FIFO within priority)
    this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

    monitor.warn(`[Offline Sync] Request failed. Enqueued to offline queue (Queue size: ${this.queue.length})`, { url, method });
    await this.saveQueue();
    this.triggerProcessing();
  }

  /**
   * Triggers processing loop if online.
   */
  private triggerProcessing() {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) return;
    this.isProcessing = true;
    this.processNext();
  }

  private async processNext() {
    if (this.queue.length === 0 || !this.isOnline) {
      this.isProcessing = false;
      return;
    }

    const request = this.queue[0];

    // Check retry bounds
    if (request.retryCount >= MOBILE_CONFIG.UPLOAD_RETRY_COUNT) {
      monitor.error(`[Offline Sync] Discarding request exceeding max retries: ${request.url}`, request);
      this.queue.shift();
      await this.saveQueue();
      this.processNext();
      return;
    }

    try {
      monitor.info(`[Offline Sync] Processing request: ${request.method} ${request.url} (Attempt ${request.retryCount + 1})`);
      
      // Inject Idempotency Key in headers to prevent duplicate executions on backend
      const config = {
        headers: {
          'Idempotency-Key': request.idempotencyKey,
        }
      };

      if (request.method === 'POST') {
        await apiClient.post(request.url, request.data, config);
      } else if (request.method === 'PATCH') {
        await apiClient.patch(request.url, request.data, config);
      } else if (request.method === 'PUT') {
        await apiClient.put(request.url, request.data, config);
      } else if (request.method === 'DELETE') {
        await apiClient.delete(request.url, config);
      }

      // Success: dequeue
      this.queue.shift();
      await this.saveQueue();
      monitor.info(`[Offline Sync] Successfully completed request: ${request.url}`);
      
      // Continue loop
      this.processNext();
    } catch (err: any) {
      monitor.warn(`[Offline Sync] Failed to process queued request. Rescheduling. Error: ${err.message || err}`);
      request.retryCount += 1;
      
      // If it's a structural 4xx client validation error, skip/discard rather than infinitely retrying
      if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 429) {
        monitor.error(`[Offline Sync] Client error. Discarding invalid queued request.`, { status: err.response.status, url: request.url });
        this.queue.shift();
        await this.saveQueue();
      }
      
      this.isProcessing = false;
    }
  }

  /**
   * Monitor online/offline state changes.
   */
  private startConnectionCheck() {
    const checkConnection = async () => {
      try {
        // Fast ping to verify true server reachability
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const fetchPromise = fetch(`${apiClient.defaults.baseURL}/api/health`);
        
        await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!this.isOnline) {
          this.isOnline = true;
          monitor.info('[Offline Sync] Device is ONLINE. Syncing queue...');
          this.triggerProcessing();
        }
      } catch {
        if (this.isOnline) {
          this.isOnline = false;
          monitor.warn('[Offline Sync] Device went OFFLINE. Operations will be queued.');
        }
      }
    };

    // Run connection ping check periodically
    checkConnection();
    this.syncTimer = setInterval(checkConnection, MOBILE_CONFIG.SYNC_RETRY_INTERVAL_MS);
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  cleanup() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();
