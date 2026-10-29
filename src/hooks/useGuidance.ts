import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGuidanceState, updateGuidanceProgress } from '@/api/guidance';
import { useAuth } from './useAuth';
import { GuideDefinition, GuideStep, ProfileCompletionResult } from '@volo/shared-types';

export const GUIDANCE_QUERY_KEY = ['guidance_state'];

export function useGuidance() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const userGuidanceKey = ['guidance_state', user?.id || 'anonymous'];

  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: userGuidanceKey,
    queryFn: () => getGuidanceState(user?.id),
    enabled: isAuthenticated && Boolean(user?.id),
    staleTime: 60 * 1000, // 1 minute
  });

  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [welcomeDismissedThisSession, setWelcomeDismissedThisSession] = useState(false);

  const mutation = useMutation({
    mutationFn: (updates: {
      completed_guides?: string[];
      dismissed_guides?: string[];
      current_flow?: string | null;
      current_step?: string | null;
    }) => updateGuidanceProgress(updates, user?.id),
    onSuccess: (newData) => {
      if (newData) {
        queryClient.setQueryData(userGuidanceKey, newData);
      } else {
        queryClient.invalidateQueries({ queryKey: userGuidanceKey });
      }
    },
  });

  const progress = data?.progress;
  const completion: ProfileCompletionResult = data?.completion || {
    percentage: 100,
    isComplete: true,
    completedItems: [],
    missingItems: [],
    items: [],
    nextStep: null,
    nextRoute: null,
  };
  const guides: GuideDefinition[] = data?.guides || [];

  const completedGuides = useMemo(
    () => new Set(progress?.completed_guides || []),
    [progress?.completed_guides]
  );
  const dismissedGuides = useMemo(
    () => new Set(progress?.dismissed_guides || []),
    [progress?.dismissed_guides]
  );

  // Active tour definition
  const activeTour = useMemo(
    () => guides.find((g) => g.id === activeTourId) || null,
    [guides, activeTourId]
  );

  const currentTourStep: GuideStep | null = useMemo(() => {
    if (!activeTour || !activeTour.steps[activeStepIndex]) return null;
    return activeTour.steps[activeStepIndex];
  }, [activeTour, activeStepIndex]);

  // Determine if welcome orientation screen should show
  // Only shows if user has NOT completed or dismissed the welcome tour, and hasn't closed it this session
  const welcomeTourId = user?.role === 'worker' ? 'worker_welcome_tour' : 'customer_welcome_tour';
  const hasCompletedWelcome = completedGuides.has(welcomeTourId);
  const hasDismissedWelcome = dismissedGuides.has(welcomeTourId);
  const shouldShowWelcome =
    isAuthenticated &&
    !isLoading &&
    !hasCompletedWelcome &&
    !hasDismissedWelcome &&
    !welcomeDismissedThisSession &&
    !activeTourId;

  const startTour = useCallback(
    (tourId: string) => {
      const tour = guides.find((g) => g.id === tourId);
      if (tour && tour.steps.length > 0) {
        setActiveTourId(tourId);
        setActiveStepIndex(0);
      }
    },
    [guides]
  );

  const nextTourStep = useCallback(() => {
    if (!activeTour) return;
    if (activeStepIndex < activeTour.steps.length - 1) {
      setActiveStepIndex((prev) => prev + 1);
    } else {
      // Completed all steps of this tour
      mutation.mutate({
        completed_guides: [activeTour.id],
        current_flow: null,
        current_step: null,
      });
      setActiveTourId(null);
      setActiveStepIndex(0);
    }
  }, [activeTour, activeStepIndex, mutation]);

  const prevTourStep = useCallback(() => {
    if (activeStepIndex > 0) {
      setActiveStepIndex((prev) => prev - 1);
    }
  }, [activeStepIndex]);

  const skipTour = useCallback(() => {
    if (activeTour) {
      mutation.mutate({
        dismissed_guides: [activeTour.id],
        current_flow: null,
        current_step: null,
      });
    }
    setActiveTourId(null);
    setActiveStepIndex(0);
  }, [activeTour, mutation]);

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissedThisSession(true);
    mutation.mutate({
      dismissed_guides: [welcomeTourId],
    });
  }, [welcomeTourId, mutation]);

  const restartTour = useCallback(
    (tourId: string) => {
      startTour(tourId);
    },
    [startTour]
  );

  return {
    progress,
    completion,
    guides,
    isLoading,
    refetchGuidance: refetch,
    // Tour state
    activeTour,
    activeTourStep: currentTourStep,
    activeStepIndex,
    totalSteps: activeTour?.steps.length || 0,
    startTour,
    nextTourStep,
    prevTourStep,
    skipTour,
    restartTour,
    // Welcome Modal state
    shouldShowWelcome,
    dismissWelcome,
  };
}
