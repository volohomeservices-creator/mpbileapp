import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Platform, Linking } from 'react-native';
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

  // States
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Job Query
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['worker-job-detail', id],
    queryFn: () => getJobById(id),
  });

  const job = data ? ((data as any).job || data) : null;

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

  useEffect(() => {
    let isCancelled = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || isCancelled) return;

      // Clear any stale watchers first
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

          // Send update to server if job is active
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
      showAlert(t('workerHome.jobAccepted'), t('workerHome.readyToStart'));
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
      router.back();
    },
  });

  const handleStartJourney = async () => {
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

  const handleStartJob = async () => {
    if (otp.length !== 4) {
      setOtpError(t('auth.incorrectPin'));
      return;
    }
    setOtpError('');
    setActionLoading(true);
    try {
      const res = await startJob(id, otp);
      if (res.success) {
        showAlert(t('bookings.in_progress'), t('workerHome.jobAcceptedMsg'));
        queryClient.invalidateQueries({ queryKey: ['worker-job-detail', id] });
      } else {
        setOtpError(t('jobs.invalidCode'));
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
        showAlert(t('bookings.completed'), t('jobs.congratsMsg'), () => {
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
      showAlert('Call Failed', 'Unable to initiate call.');
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
      default:
        return 'brand';
    }
  };

  const getStatusLabel = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING_ASSIGNMENT:
        return t('bookings.pending_assignment');
      case BookingStatus.MANUAL_ASSIGNMENT_REQUIRED:
        return t('bookings.manual_assignment_required');
      case BookingStatus.WORKER_ASSIGNED:
        return t('bookings.worker_assigned');
      case BookingStatus.WORKER_ACCEPTED:
        return t('bookings.worker_accepted');
      case BookingStatus.ON_THE_WAY:
        return t('bookings.on_the_way');
      case BookingStatus.ARRIVED:
        return t('bookings.arrived');
      case BookingStatus.IN_PROGRESS:
        return t('bookings.in_progress');
      case BookingStatus.COMPLETED:
        return t('bookings.completed');
      case BookingStatus.CANCELLED:
        return t('bookings.cancelled');
      default:
        return status.replace(/_/g, ' ').toLowerCase();
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
        <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
      </View>
    );
  }

  if (isError || !job) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Ionicons name="alert-circle-outline" size={48} color="rgb(var(--danger))" />
        <Text className="text-text-primary text-lg font-bold mt-4">{t('bookings.bookingNotFound')}</Text>
        <Button label={t('workerHome.goToJob')} onPress={() => router.back()} className="mt-4" />
      </View>
    );
  }

  // Determine current active workflow button
  const renderWorkflowButton = () => {
    if (actionLoading) {
      return (
        <View className="h-14 justify-center items-center bg-white rounded-xl border border-border-primary mb-8 shadow-sm">
          <ActivityIndicator color="rgb(var(--brand-orange))" />
        </View>
      );
    }

    switch (job.status) {
      case BookingStatus.WORKER_ASSIGNED:
      case BookingStatus.PENDING_ASSIGNMENT:
        return (
          <View className="flex-row gap-3 mb-8">
            <Button
              label={t('jobs.decline')}
              variant="outline"
              size="lg"
              onPress={() => rejectMutation.mutate()}
              className="flex-1"
            />
            <Button
              label={t('jobs.acceptShift')}
              variant="brand"
              size="lg"
              onPress={() => acceptMutation.mutate()}
              className="flex-1"
            />
          </View>
        );

      case BookingStatus.WORKER_ACCEPTED:
        return (
          <Button
            label={t('jobs.startJourneyBtn')}
            variant="brand"
            size="lg"
            onPress={handleStartJourney}
            className="mb-8"
          />
        );

      case BookingStatus.ON_THE_WAY:
        return (
          <Button
            label={t('jobs.arrivedAtLocation')}
            variant="primary"
            size="lg"
            onPress={handleMarkArrived}
            className="mb-8 bg-success"
          />
        );

      case BookingStatus.ARRIVED:
        return (
          <View className="mb-8">
            <Card variant="default" className="p-5 bg-white border border-border-primary">
              <Text className="text-text-primary text-sm font-extrabold mb-1">{t('jobs.verifyStartOtp')}</Text>
              <Text className="text-text-secondary text-xs mb-4">
                {t('jobs.enterCodeMsg')}
              </Text>
              
              <View className="flex-row gap-3 mb-3">
                <TextInput
                  placeholder={t('jobs.fourDigitPin')}
                  placeholderTextColor="rgb(var(--text-muted))"
                  keyboardType="numeric"
                  maxLength={4}
                  value={otp}
                  onChangeText={setOtp}
                  className="flex-1 h-12 px-4 rounded-xl border bg-background-secondary text-text-primary text-center text-lg font-bold border-border-secondary focus:border-brand-orange focus:bg-background-card"
                />
                <Button
                  label={t('jobs.verifyBtn')}
                  variant="brand"
                  size="md"
                  onPress={handleStartJob}
                  className="px-6 h-12"
                />
              </View>
              {otpError ? (
                <Text className="text-danger text-xs font-semibold">{otpError}</Text>
              ) : null}
            </Card>
          </View>
        );

      case BookingStatus.IN_PROGRESS:
        return (
          <Button
            label={t('jobs.completeJobShift')}
            variant="brand"
            size="lg"
            onPress={handleCompleteJob}
            className="mb-8"
          />
        );

      default:
        return null;
    }
  };

  const customerName = job?.customer?.full_name || 'Customer';
  const customerPhone = job?.customer?.phone || '+919999999999';

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white shadow-sm">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} className="mr-4">
          <Ionicons name="arrow-back" size={22} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold flex-1" numberOfLines={1}>
          {t('jobs.jobDetails')}
        </Text>
        <Badge
          label={getStatusLabel(job.status)}
          variant={getStatusVariant(job.status)}
        />
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Customer Location on Map */}
        {[
          BookingStatus.WORKER_ACCEPTED,
          BookingStatus.ON_THE_WAY,
          BookingStatus.ARRIVED,
          BookingStatus.IN_PROGRESS,
        ].includes(job.status) ? (
          <View className="mb-6">
            <Text className="text-text-primary text-sm font-extrabold mb-3">{t('jobs.serviceShiftRoute')}</Text>
            <MapPlaceholder
              workerLat={currentCoords?.lat}
              workerLng={currentCoords?.lng}
              destLat={job.lat}
              destLng={job.lng}
              workerName="You (Worker)"
              statusText={getStatusLabel(job.status)}
            />
            {job.status === BookingStatus.ON_THE_WAY && (
              <Button
                label="Start Turn-by-Turn Navigation"
                variant="primary"
                size="md"
                onPress={() => {
                  const url = Platform.select({
                    ios: `maps://?daddr=${job.lat},${job.lng}`,
                    android: `google.navigation:q=${job.lat},${job.lng}`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`
                  });
                  Linking.openURL(url).catch(() => {
                    showAlert('Navigation Error', 'Could not open native navigation app.');
                  });
                }}
                className="mt-3 w-full shadow-premium"
              />
            )}
          </View>
        ) : null}

        {/* Customer Detail Card */}
        {[
          BookingStatus.WORKER_ACCEPTED,
          BookingStatus.ON_THE_WAY,
          BookingStatus.ARRIVED,
          BookingStatus.IN_PROGRESS,
        ].includes(job.status) ? (
          <View className="mb-6">
            <Card variant="default" className="p-5">
              <Text className="text-text-muted text-[10px] font-extrabold uppercase tracking-wider mb-3">
                {t('jobs.customerInfo')}
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-11 h-11 rounded-full bg-brand-orange/10 border border-brand-orange/20 justify-center items-center mr-3">
                    <Ionicons name="person" size={20} color="rgb(var(--brand-orange))" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-primary text-sm font-extrabold" numberOfLines={1}>
                      {customerName}
                    </Text>
                    <Text className="text-text-secondary text-xs mt-0.5">Rating: 4.9★</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleCallCustomer(customerPhone)}
                  activeOpacity={0.8}
                  className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 justify-center items-center active:bg-success/20"
                >
                  <Ionicons name="call" size={18} color="rgb(var(--success))" />
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        ) : null}

        {/* Job Info */}
        <View className="mb-6">
          <Card variant="default" className="p-5">
            <Text className="text-text-muted text-[10px] font-extrabold uppercase tracking-wider mb-4">
              {t('jobs.bookingDetails')}
            </Text>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('jobs.jobType')}</Text>
              <Text className="text-text-primary text-xs font-bold">{job.service?.name ?? 'Home Cleaning'}</Text>
            </View>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('jobs.earningsShare')}</Text>
              <Text className="text-brand-orange text-xs font-extrabold">₹{job.estimated_earnings ?? (job.total_amount * 0.85).toFixed(0)}</Text>
            </View>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('bookings.paymentMode')}</Text>
              <Text className="text-text-primary text-xs font-bold">{job.payment_mode}</Text>
            </View>

            <View className="h-[1px] bg-border-primary my-3" />

            <View className="mb-2">
              <Text className="text-text-secondary text-xs mb-1.5">{t('jobs.customerAddress')}</Text>
              <Text className="text-text-primary text-xs leading-4.5">{job.address_line}</Text>
            </View>

            {job.notes ? (
              <View className="mt-3">
                <Text className="text-text-secondary text-xs mb-1.5">{t('jobs.specialRequest')}</Text>
                <Text className="text-text-secondary text-xs italic leading-4.5 font-medium">"{job.notes}"</Text>
              </View>
            ) : null}
          </Card>
        </View>

        {/* Workflow actions */}
        {renderWorkflowButton()}
      </ScrollView>
    </SafeAreaView>
  );
}
