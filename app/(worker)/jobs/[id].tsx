import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Platform, Linking, BackHandler, KeyboardAvoidingView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getJobById, acceptJob, rejectJob, startJob, completeJob, startJourney, markArrived } from '@/api/jobs';
import { pushWorkerLocation } from '@/api/tracking';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { usePolling } from '@/hooks/usePolling';
import { BookingStatus } from '@volo/shared-types';
import { useLanguage } from '@/hooks/useLanguage';

// Platform-resilient showAlert helper
const showAlert = (title: string, message: string, callback?: () => void) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
    if (callback) callback();
  } else {
    if (callback) {
      Alert.alert(title, message, [{ text: 'OK', onPress: callback }]);
    } else {
      Alert.alert(title, message);
    }
  }
};

export default function WorkerJobDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(worker)/home');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  // States
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const otpInputRef = useRef<TextInput>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showFullMap, setShowFullMap] = useState(true);

  // Job Query
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['worker-job-detail', id],
    queryFn: () => getJobById(id),
  });

  const job = data ? ((data as any).job || data) : null;

  // 2-Minute Offer Expiration Countdown Timer for Worker
  const [offerSecondsLeft, setOfferSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!job || ![BookingStatus.WORKER_ASSIGNED, BookingStatus.PENDING_ASSIGNMENT].includes(job.status)) {
      setOfferSecondsLeft(null);
      return;
    }

    const expiresAtMs = job.expiresAt
      ? new Date(job.expiresAt).getTime()
      : (job.created_at ? new Date(job.created_at).getTime() + 120000 : Date.now() + 120000);

    const calcLeft = () => Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

    setOfferSecondsLeft(calcLeft());

    const timer = setInterval(() => {
      const left = calcLeft();
      setOfferSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [job?.expiresAt, job?.created_at, job?.status]);

  // Poll job status and details dynamically
  const isPolled =
    job &&
    ![BookingStatus.COMPLETED, BookingStatus.CANCELLED].includes(job.status);

  usePolling(
    async () => {
      await refetch();
    },
    isPolled ? 10000 : null,
    !!isPolled
  );

  // Track worker GPS position on active job
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Immediate GPS lock on mount
  useEffect(() => {
    let isCancelled = false;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted' && !isCancelled) {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((loc) => {
            if (!isCancelled && loc?.coords) {
              setCurrentCoords({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
              });
            }
          })
          .catch(() => {});
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Continuous GPS watcher when actively on shift
  useEffect(() => {
    let isCancelled = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || isCancelled) return;

      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
        },
        (loc) => {
          if (isCancelled) return;
          setCurrentCoords({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });

          if (
            job &&
            [BookingStatus.ON_THE_WAY, BookingStatus.IN_PROGRESS].includes(job.status)
          ) {
            pushWorkerLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
              speed: loc.coords.speed ?? undefined,
              heading: loc.coords.heading ?? undefined,
              deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
            }).catch(console.error);
          }
        }
      );

      if (isCancelled) {
        sub.remove();
      } else {
        watchSubscriptionRef.current = sub;
      }
    };

    if (
      job &&
      [BookingStatus.WORKER_ACCEPTED, BookingStatus.ON_THE_WAY, BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS].includes(
        job.status
      )
    ) {
      startTracking();
    }

    return () => {
      isCancelled = true;
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
    };
  }, [job?.status]);

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: () => acceptJob(id),
    onSuccess: () => {
      const isSched = !!(job?.scheduled_at && new Date(job.scheduled_at) > new Date());
      if (isSched) {
        const timeStr = new Date(job.scheduled_at).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        showAlert('Scheduled Shift Confirmed! 📅', `Shift confirmed for ${timeStr}. This appointment is saved in your Upcoming Jobs list.`);
      } else {
        showAlert(t('workerHome.jobAccepted'), t('workerHome.readyToStart'));
      }
      queryClient.invalidateQueries({ queryKey: ['worker-job-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
    },
    onError: (err: any) => {
      showAlert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectJob(id, 'Decline offer'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['worker-available-jobs'] });
      handleBack();
    },
  });

  const handleStartJourney = async () => {
    const isFutureScheduled = !!(job?.scheduled_at && (new Date(job.scheduled_at).getTime() - Date.now() > 45 * 60 * 1000));
    if (isFutureScheduled) {
      const schedTimeStr = new Date(job.scheduled_at).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const proceed = Platform.OS === 'web'
        ? window.confirm(`This job is scheduled for ${schedTimeStr}. Are you sure you want to start journey early?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Scheduled Shift Early Start',
              `This job is scheduled for ${schedTimeStr}. Do you want to start journey now?`,
              [
                { text: 'Wait', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Start Journey', onPress: () => resolve(true) }
              ]
            );
          });
      if (!proceed) return;
    }

    setActionLoading(true);
    try {
      const res = await startJourney(id);
      if (res.success) {
        showAlert(t('jobs.journeyStarted'), t('jobs.gpsTrackingMsg'));
        refetch();
      }
    } catch (err: any) {
      showAlert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkArrived = async () => {
    setActionLoading(true);
    try {
      const res = await markArrived(id);
      if (res.success) {
        showAlert(t('jobs.arrivedAlert'), t('jobs.arrivedAlertMsg'));
        refetch();
      }
    } catch (err: any) {
      showAlert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartJob = async (codeToVerify?: string) => {
    const finalOtp = codeToVerify ?? otp;
    if (finalOtp.length !== 4) {
      setOtpError(t('auth.incorrectPin') || 'Please enter the complete 4-digit PIN');
      return;
    }
    setOtpError('');
    setActionLoading(true);
    try {
      const res = await startJob(id, finalOtp);
      if (res.success) {
        showAlert('Service Started! ✓', 'Work has begun. Mark complete when you finish the task.');
        queryClient.invalidateQueries({ queryKey: ['worker-job-detail', id] });
        refetch();
      } else {
        setOtpError(t('jobs.invalidCode') || 'Incorrect OTP code entered');
      }
    } catch (err: any) {
      setOtpError(err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    setActionLoading(true);
    try {
      const res = await completeJob(id);
      if (res.success) {
        showAlert('Shift Completed! 🎉', t('jobs.congratsMsg'), () => {
          queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
          router.replace('/(worker)/home');
        });
      }
    } catch (err: any) {
      showAlert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCallCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showAlert('Call Failed', 'Unable to initiate call on this device.');
    });
  };

  const handleOpenNavigation = (lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps://?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    });
    Linking.openURL(url).catch(() => {
      showAlert('Navigation Error', 'Could not open native navigation app.');
    });
  };

  const getStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.COMPLETED:
        return 'success';
      case BookingStatus.CANCELLED:
        return 'error';
      case BookingStatus.WORKER_ASSIGNED:
        return 'warning';
      case BookingStatus.ARRIVED:
        return 'brand-orange';
      default:
        return 'brand';
    }
  };

  const getStatusLabel = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING_ASSIGNMENT:
        return t('bookings.pending_assignment') || 'Pending Assignment';
      case BookingStatus.MANUAL_ASSIGNMENT_REQUIRED:
        return t('bookings.manual_assignment_required') || 'Manual Assignment';
      case BookingStatus.WORKER_ASSIGNED:
        return t('bookings.worker_assigned') || 'Assigned to You';
      case BookingStatus.WORKER_ACCEPTED:
        return t('bookings.worker_accepted') || 'Shift Accepted';
      case BookingStatus.ON_THE_WAY:
        return t('bookings.on_the_way') || 'En Route';
      case BookingStatus.ARRIVED:
        return t('bookings.arrived') || 'Arrived at Site';
      case BookingStatus.IN_PROGRESS:
        return t('bookings.in_progress') || 'In Progress';
      case BookingStatus.COMPLETED:
        return t('bookings.completed') || 'Completed';
      case BookingStatus.CANCELLED:
        return t('bookings.cancelled') || 'Cancelled';
      default:
        return status.replace(/_/g, ' ').toLowerCase();
    }
  };

  // Helper for Stepper stages
  const getStepIndex = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.WORKER_ASSIGNED:
      case BookingStatus.PENDING_ASSIGNMENT:
        return 0;
      case BookingStatus.WORKER_ACCEPTED:
        return 1;
      case BookingStatus.ON_THE_WAY:
        return 2;
      case BookingStatus.ARRIVED:
        return 3;
      case BookingStatus.IN_PROGRESS:
        return 4;
      case BookingStatus.COMPLETED:
        return 5;
      default:
        return 0;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#3C01A7" />
        <Text className="text-slate-500 text-xs mt-3 font-semibold">{t('common.loading')}</Text>
      </View>
    );
  }

  if (isError || !job) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 px-6">
        <Ionicons name="alert-circle-outline" size={54} color="#EF4444" />
        <Text className="text-slate-900 text-lg font-bold mt-4">{t('bookings.bookingNotFound')}</Text>
        <Button label={t('workerHome.goToJob') || 'Go Back'} onPress={handleBack} className="mt-5" />
      </View>
    );
  }

  const customerName = job?.customer?.full_name || 'Customer';
  const customerPhone = job?.customer?.phone || '+919999999999';
  const currentStep = getStepIndex(job.status);
  const earningsAmount = job.estimated_earnings ?? (job.total_amount ? (job.total_amount * 0.85).toFixed(2) : '0.00');

  // Render Interactive Workflow Action Component
  const renderWorkflowButton = () => {
    if (actionLoading) {
      return (
        <View className="h-14 justify-center items-center bg-white rounded-2xl border border-slate-200 mb-8 shadow-sm">
          <ActivityIndicator color="#3C01A7" />
        </View>
      );
    }

    switch (job.status) {
      case BookingStatus.WORKER_ASSIGNED:
      case BookingStatus.PENDING_ASSIGNMENT: {
        const isOfferExpired = offerSecondsLeft !== null && offerSecondsLeft <= 0;
        const mins = Math.floor((offerSecondsLeft || 0) / 60);
        const secs = (offerSecondsLeft || 0) % 60;
        const countdownStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        return (
          <View className="mb-8">
            {/* Offer Timer Banner */}
            <View className="p-3 bg-purple-50 rounded-2xl border border-purple-200/80 mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Ionicons name={job?.scheduled_at ? "calendar" : "flash"} size={16} color="#3C01A7" />
                <View className="flex-1">
                  <Text className="text-[#3C01A7] font-extrabold text-xs">
                    {job?.scheduled_at ? '📅 Scheduled Order Offer' : '⚡ New Order Offer (2-Min Window)'}
                  </Text>
                  <Text className="text-slate-500 text-[10px]">
                    {job?.scheduled_at
                      ? `Appointment: ${new Date(job.scheduled_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : (isOfferExpired ? 'Offer window expired' : 'Accept before timer expires to confirm order')}
                  </Text>
                </View>
              </View>
              <View className={`px-2.5 py-1 rounded-xl border ${isOfferExpired ? 'bg-red-50 border-red-200' : 'bg-white border-purple-200'}`}>
                <Text className={`text-xs font-black font-mono ${isOfferExpired ? 'text-red-600' : 'text-[#3C01A7]'}`}>
                  {isOfferExpired ? 'EXPIRED' : countdownStr}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending || acceptMutation.isPending}
                activeOpacity={0.8}
                className="flex-1 h-13 rounded-2xl border border-red-200 bg-red-50/80 justify-center items-center flex-row gap-1.5"
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                    <Text className="text-red-600 font-extrabold text-sm">{t('jobs.decline') || 'Decline'}</Text>
                  </>
                )}
              </TouchableOpacity>

              {isOfferExpired ? (
                <View className="flex-1 h-13 rounded-2xl bg-slate-100 border border-slate-200 justify-center items-center">
                  <Text className="text-slate-400 font-extrabold text-xs">Offer Expired</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => acceptMutation.mutate()}
                  disabled={rejectMutation.isPending || acceptMutation.isPending}
                  activeOpacity={0.85}
                  className="flex-1 h-13 rounded-2xl bg-[#3C01A7] shadow-md shadow-[#3C01A7]/30 justify-center items-center flex-row gap-2"
                >
                  {acceptMutation.isPending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={19} color="white" />
                      <Text className="text-white font-extrabold text-sm">{t('jobs.acceptShift') || 'Accept Shift'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      }

      case BookingStatus.WORKER_ACCEPTED: {
        const isFuture = !!(job?.scheduled_at && new Date(job.scheduled_at) > new Date());
        return (
          <View className="mb-8">
            {isFuture && (
              <View className="bg-purple-50 border border-purple-200 p-4 rounded-2xl mb-3 flex-row items-center gap-3">
                <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
                <View className="flex-1">
                  <Text className="text-purple-950 font-extrabold text-xs">
                    Reserved Scheduled Shift 📅
                  </Text>
                  <Text className="text-purple-700 text-[11px] font-semibold mt-0.5">
                    {new Date(job.scheduled_at).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                  <Text className="text-purple-600 text-[10px] mt-0.5">
                    Job is locked in your Upcoming schedule. Start journey closer to appointment time.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleStartJourney}
              activeOpacity={0.85}
              className="w-full h-14 rounded-2xl bg-[#3C01A7] shadow-premium flex-row justify-center items-center gap-2 active:scale-[0.99]"
            >
              <Ionicons name="navigate-outline" size={20} color="white" />
              <Text className="text-white font-extrabold text-base">
                {isFuture ? 'Start Journey to Location' : (t('jobs.startJourneyBtn') || 'Start Journey to Location →')}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      case BookingStatus.ON_THE_WAY:
        return (
          <TouchableOpacity
            onPress={handleMarkArrived}
            activeOpacity={0.85}
            className="w-full h-14 rounded-2xl bg-emerald-600 shadow-premium flex-row justify-center items-center gap-2 mb-8 active:scale-[0.99]"
          >
            <Ionicons name="location" size={20} color="white" />
            <Text className="text-white font-extrabold text-base">
              {t('jobs.arrivedAtLocation') || 'I Have Arrived at Location 📍'}
            </Text>
          </TouchableOpacity>
        );

      case BookingStatus.ARRIVED:
        return null; // Handled prominently in the dedicated Start OTP Card

      case BookingStatus.IN_PROGRESS:
        return (
          <TouchableOpacity
            onPress={handleCompleteJob}
            activeOpacity={0.85}
            className="w-full h-14 rounded-2xl bg-emerald-600 shadow-premium flex-row justify-center items-center gap-2 mb-8 active:scale-[0.99]"
          >
            <Ionicons name="checkmark-done-circle" size={22} color="white" />
            <Text className="text-white font-extrabold text-base">
              {t('jobs.completeJobShift') || 'Complete Shift & Finish ✓'}
            </Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="bg-white border-b border-slate-200/80 px-4 py-3.5 shadow-sm">
        <View className="max-w-md w-full mx-auto flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-full bg-slate-100 justify-center items-center mr-3 active:bg-slate-200"
            >
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
            </TouchableOpacity>
            <View>
              <Text className="text-slate-900 text-base font-extrabold">
                {t('jobs.jobDetails') || 'Job Details'}
              </Text>
              <Text className="text-slate-400 text-[10px] font-mono">
                #{id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>
          <Badge
            label={getStatusLabel(job.status)}
            variant={getStatusVariant(job.status)}
            size="md"
          />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 64 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View className="max-w-md w-full mx-auto">
          {/* Visual Step Progress Tracker */}
          <View className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-premium mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                Shift Progress
              </Text>
              <Text className="text-purple-700 text-[11px] font-bold">
                Step {Math.min(currentStep, 4) + 1} of 5
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              {[
                { title: 'Offer', icon: 'receipt-outline' },
                { title: 'Accepted', icon: 'thumbs-up-outline' },
                { title: 'En Route', icon: 'navigate-outline' },
                { title: 'Arrived', icon: 'location-outline' },
                { title: 'Working', icon: 'construct-outline' },
              ].map((step, idx) => {
                const isPassed = currentStep > idx;
                const isCurrent = currentStep === idx;
                return (
                  <View key={idx} className="items-center flex-1">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center border-2 ${
                        isCurrent
                          ? 'bg-[#3C01A7] border-[#3C01A7] shadow-sm'
                          : isPassed
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Ionicons
                        name={isPassed ? 'checkmark' : (step.icon as any)}
                        size={14}
                        color={isPassed || isCurrent ? 'white' : '#94A3B8'}
                      />
                    </View>
                    <Text
                      className={`text-[9px] font-bold mt-1 text-center ${
                        isCurrent
                          ? 'text-[#3C01A7] font-extrabold'
                          : isPassed
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                      numberOfLines={1}
                    >
                      {step.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Dynamic Stage Banner */}
          {job.status === BookingStatus.ARRIVED && (
            <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center">
                <Ionicons name="key" size={20} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-900 font-extrabold text-sm">
                  Arrived at Customer Location!
                </Text>
                <Text className="text-amber-700 text-xs mt-0.5">
                  Ask customer for their 4-digit PIN to start the service.
                </Text>
              </View>
            </View>
          )}

          {job.status === BookingStatus.ON_THE_WAY && (
            <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-blue-500/20 items-center justify-center">
                <Ionicons name="navigate" size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-blue-900 font-extrabold text-sm">
                  Live GPS En Route Active
                </Text>
                <Text className="text-blue-700 text-xs mt-0.5">
                  Customer can see your live position. Tap Arrived when at site.
                </Text>
              </View>
            </View>
          )}

          {job.status === BookingStatus.IN_PROGRESS && (
            <View className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-purple-500/20 items-center justify-center">
                <Ionicons name="flash" size={20} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-purple-900 font-extrabold text-sm">
                  Job In Progress ⚡
                </Text>
                <Text className="text-purple-700 text-xs mt-0.5">
                  Service is currently running. Tap Complete when finished.
                </Text>
              </View>
            </View>
          )}

          {/* DEDICATED VERIFY START OTP CARD (Prominent in ARRIVED state) */}
          {job.status === BookingStatus.ARRIVED && (
            <View className="bg-white rounded-3xl p-6 border border-purple-200/90 shadow-premium mb-5">
              {/* Card Header */}
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-9 h-9 rounded-xl bg-purple-100 items-center justify-center">
                    <Ionicons name="shield-checkmark" size={18} color="#3C01A7" />
                  </View>
                  <View>
                    <Text className="text-slate-900 font-extrabold text-base">
                      {t('jobs.verifyStartOtp') || 'Verify Start PIN'}
                    </Text>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                      Security Handshake
                    </Text>
                  </View>
                </View>
                <Badge label="Required to Start" variant="brand" size="sm" />
              </View>

              <Text className="text-slate-500 text-xs mt-1 mb-5 leading-relaxed font-medium">
                {t('jobs.enterCodeMsg') || 'Ask the customer for the 4-digit start PIN displayed on their booking screen.'}
              </Text>

              {/* Invisible Active Input Controller (Keeps keyboard open & syncs seamlessly) */}
              <TextInput
                ref={otpInputRef}
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                  setOtp(cleaned);
                  if (otpError) setOtpError('');
                  if (cleaned.length === 4) {
                    handleStartJob(cleaned);
                  }
                }}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  opacity: 0,
                }}
                autoFocus={true}
              />

              {/* Interactive 4-Digit Box Display */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => otpInputRef.current?.focus()}
                className="flex-row justify-center gap-3.5 mb-5"
              >
                {[0, 1, 2, 3].map((idx) => {
                  const digit = otp[idx] || '';
                  const isCurrent = otp.length === idx;
                  const isFilled = Boolean(digit);
                  return (
                    <View
                      key={idx}
                      style={{
                        width: 58,
                        height: 68,
                        borderRadius: 18,
                        borderWidth: isCurrent ? 2.5 : isFilled ? 2 : 1.5,
                        borderColor: isCurrent ? '#3C01A7' : isFilled ? '#4C1D95' : '#E2E8F0',
                        backgroundColor: isCurrent ? '#FAF5FF' : isFilled ? '#FFFFFF' : '#F8FAFC',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: isCurrent ? '#3C01A7' : '#000000',
                        shadowOffset: { width: 0, height: isCurrent ? 3 : 1 },
                        shadowOpacity: isCurrent ? 0.2 : 0.04,
                        shadowRadius: isCurrent ? 6 : 2,
                        elevation: isCurrent ? 3 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 28,
                          fontWeight: '900',
                          color: '#0F172A',
                          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        }}
                      >
                        {digit}
                      </Text>
                      {/* Active Cursor Indicator */}
                      {isCurrent && !digit && (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: 14,
                            width: 18,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: '#3C01A7',
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </TouchableOpacity>

              {/* Clear Link when digits entered */}
              {otp.length > 0 && !actionLoading && (
                <View className="flex-row justify-end mb-3 pr-2">
                  <TouchableOpacity
                    onPress={() => {
                      setOtp('');
                      if (otpError) setOtpError('');
                      otpInputRef.current?.focus();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text className="text-xs font-bold text-[#3C01A7]">Clear code</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Error Message */}
              {otpError ? (
                <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 flex-row items-center gap-2.5">
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text className="text-red-700 text-xs font-bold flex-1">{otpError}</Text>
                </View>
              ) : null}

              {/* Clean, High-End Action Button */}
              <TouchableOpacity
                onPress={() => handleStartJob()}
                disabled={actionLoading || otp.length !== 4}
                activeOpacity={0.88}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 18,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor:
                    otp.length === 4 && !actionLoading ? '#3C01A7' : '#E2E8F0',
                  shadowColor: '#3C01A7',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: otp.length === 4 ? 0.25 : 0,
                  shadowRadius: 8,
                  elevation: otp.length === 4 ? 4 : 0,
                }}
              >
                {actionLoading ? (
                  <>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
                      Verifying PIN...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color={otp.length === 4 ? '#FFFFFF' : '#94A3B8'}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: otp.length === 4 ? '#FFFFFF' : '#94A3B8',
                        letterSpacing: 0.3,
                      }}
                    >
                      {otp.length === 4 ? 'Verify PIN & Start Job' : 'Enter 4-Digit Customer PIN'}
                    </Text>
                    {otp.length === 4 && (
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Customer Profile & Direct Contact Card */}
          {[
            BookingStatus.WORKER_ACCEPTED,
            BookingStatus.ON_THE_WAY,
            BookingStatus.ARRIVED,
            BookingStatus.IN_PROGRESS,
          ].includes(job.status) && (
            <View className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-premium mb-4">
              <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-3">
                {t('jobs.customerInfo') || 'Customer Information'}
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-12 h-12 rounded-2xl bg-purple-100/70 border border-purple-200 items-center justify-center mr-3">
                    <Ionicons name="person" size={22} color="#3C01A7" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-slate-900 text-sm font-extrabold" numberOfLines={1}>
                        {customerName}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    </View>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text className="text-slate-600 text-xs font-semibold">4.9</Text>
                      <Text className="text-slate-400 text-[10px]">• Verified Customer</Text>
                    </View>
                  </View>
                </View>

                {/* Call Customer Quick Action */}
                <TouchableOpacity
                  onPress={() => handleCallCustomer(customerPhone)}
                  activeOpacity={0.8}
                  className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex-row items-center gap-1.5 active:bg-emerald-100"
                >
                  <Ionicons name="call" size={16} color="#059669" />
                  <Text className="text-emerald-700 text-xs font-bold">Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Route Map Section */}
          {[
            BookingStatus.WORKER_ACCEPTED,
            BookingStatus.ON_THE_WAY,
            BookingStatus.ARRIVED,
            BookingStatus.IN_PROGRESS,
          ].includes(job.status) && (
            <View className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-premium mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="map-outline" size={16} color="#3C01A7" />
                  <Text className="text-slate-900 text-xs font-extrabold">
                    {t('jobs.serviceShiftRoute') || 'Service Location & Route'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleOpenNavigation(job.lat, job.lng)}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200"
                >
                  <Ionicons name="navigate" size={12} color="#3C01A7" />
                  <Text className="text-[#3C01A7] text-[10px] font-bold">Open Maps</Text>
                </TouchableOpacity>
              </View>

              <MapPlaceholder
                workerLat={currentCoords?.lat}
                workerLng={currentCoords?.lng}
                destLat={job.lat}
                destLng={job.lng}
                workerName="You (Captain)"
                statusText={getStatusLabel(job.status)}
              />

              {/* Turn-by-Turn GPS Button */}
              {[BookingStatus.WORKER_ACCEPTED, BookingStatus.ON_THE_WAY, BookingStatus.ARRIVED].includes(job.status) && (
                <TouchableOpacity
                  onPress={() => handleOpenNavigation(job.lat, job.lng)}
                  activeOpacity={0.8}
                  className="mt-3 w-full h-11 rounded-xl bg-slate-900 flex-row items-center justify-center gap-2 active:bg-slate-800"
                >
                  <Ionicons name="navigate-circle" size={18} color="white" />
                  <Text className="text-white text-xs font-bold">
                    Start Turn-by-Turn Navigation (Google Maps)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Job & Payout Summary Card */}
          <View className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-premium mb-4">
            <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-3">
              {t('jobs.bookingDetails') || 'Job & Earnings Details'}
            </Text>

            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="construct-outline" size={15} color="#64748B" />
                <Text className="text-slate-600 text-xs font-medium">{t('jobs.jobType') || 'Job Type'}</Text>
              </View>
              <Text className="text-slate-900 text-xs font-bold capitalize">
                {job.service?.name ?? 'Home Service'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2.5 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cash-outline" size={15} color="#059669" />
                <Text className="text-slate-600 text-xs font-medium">{t('jobs.earningsShare') || 'Your Net Payout'}</Text>
              </View>
              <View className="bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Text className="text-emerald-700 text-xs font-extrabold">₹{earningsAmount}</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="card-outline" size={15} color="#64748B" />
                <Text className="text-slate-600 text-xs font-medium">{t('bookings.paymentMode') || 'Payment Mode'}</Text>
              </View>
              <Text className="text-slate-800 text-xs font-bold uppercase">
                {job.payment_mode || 'ONLINE'}
              </Text>
            </View>

            {/* Address */}
            <View className="pt-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text className="text-slate-500 text-[11px] font-semibold">
                  {t('jobs.customerAddress') || 'Customer Address'}
                </Text>
              </View>
              <Text className="text-slate-800 text-xs font-medium leading-4.5 pl-5">
                {job.address_line}
              </Text>
            </View>

            {job.notes ? (
              <View className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                  {t('jobs.specialRequest') || 'Special Instructions'}
                </Text>
                <Text className="text-slate-700 text-xs italic leading-4 font-medium">
                  "{job.notes}"
                </Text>
              </View>
            ) : null}
          </View>

          {/* Workflow Bottom Actions */}
          {renderWorkflowButton()}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
