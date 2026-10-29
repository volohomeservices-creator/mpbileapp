import { apiClient } from './client';
import { storage } from '@/utils/storage';
import { GuidanceApiResponse, UserGuidanceProgress } from '@volo/shared-types';

const getStorageKey = (userId?: string) =>
  userId ? `volo_guidance_cache_${userId}` : 'volo_guidance_cache';

export async function getGuidanceState(userId?: string): Promise<GuidanceApiResponse> {
  const cacheKey = getStorageKey(userId);
  try {
    const res = await apiClient.get<GuidanceApiResponse>('/api/user/guidance');
    if (res.data) {
      await storage.setItem(cacheKey, JSON.stringify(res.data));
      return res.data;
    }
  } catch (error) {
    console.warn('Network error fetching guidance, trying local cache...');
  }

  // Fallback to local cache if network request fails or offline
  const cached = await storage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }

  // Safe fallback if never cached
  return {
    progress: {
      user_id: '',
      role: 'customer',
      completed_guides: [],
      dismissed_guides: [],
      current_flow: null,
      current_step: null,
      flow_version: 1,
    },
    completion: {
      percentage: 100,
      isComplete: true,
      completedItems: [],
      missingItems: [],
      items: [],
      nextStep: null,
      nextRoute: null,
    },
    guides: [],
  };
}

export async function updateGuidanceProgress(
  updates: {
    completed_guides?: string[];
    dismissed_guides?: string[];
    current_flow?: string | null;
    current_step?: string | null;
  },
  userId?: string
): Promise<GuidanceApiResponse | null> {
  const cacheKey = getStorageKey(userId);
  try {
    const res = await apiClient.post<GuidanceApiResponse>('/api/user/guidance', updates);
    if (res.data) {
      await storage.setItem(cacheKey, JSON.stringify(res.data));
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to sync guidance progress to backend, updating local cache:', err);
    // Optimistic local update
    const cached = await storage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed: GuidanceApiResponse = JSON.parse(cached);
        if (updates.completed_guides) {
          parsed.progress.completed_guides = Array.from(
            new Set([...parsed.progress.completed_guides, ...updates.completed_guides])
          );
        }
        if (updates.dismissed_guides) {
          parsed.progress.dismissed_guides = Array.from(
            new Set([...parsed.progress.dismissed_guides, ...updates.dismissed_guides])
          );
        }
        if (updates.current_flow !== undefined) parsed.progress.current_flow = updates.current_flow;
        if (updates.current_step !== undefined) parsed.progress.current_step = updates.current_step;
        await storage.setItem(cacheKey, JSON.stringify(parsed));
        return parsed;
      } catch {}
    }
  }
  return null;
}
