import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getWorkerDashboard, getAvailableJobs, acceptJob, rejectJob, getCurrentJob, getManualOffers, acceptManualOffer, rejectManualOffer } from '@/api/jobs';
import { updateWorkerStatus, pushWorkerLocation } from '@/api/tracking';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { JobCard } from '@/components/JobCard';
import { formatCurrency } from '@/utils/formatCurrency';
import { useLanguage } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// Platform-resilient showAlert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Countdown Timer Component for Direct/Manual Offers
const OfferTimer = ({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calc = () => Math.max(Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000), 0);
    setTimeLeft(calc());
    const timer = setInterval(() => {
      const left = calc();
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  if (timeLeft <= 0) {
    return <Badge label="Expired" variant="error" size="sm" />;
  }

  return (
    <Badge 
      label={`⏰ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`} 
      variant={timeLeft < 60 ? 'error' : 'warning'} 
      size="sm" 
    />
  );
};

export default function WorkerHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  
  // State
  const [isOnline, setIsOnline] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Queries
  const {
    data: dashboardData,
    isLoading: dashLoading,
    refetch: refetchDash,
  } = useQuery({
    queryKey: ['worker-dashboard'],
    queryFn: getWorkerDashboard,
  });

  const {
    data: availableData,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ['worker-available-jobs'],
    queryFn: () => getAvailableJobs('available'),
    enabled: isOnline,
    refetchInterval: 15000,       // Poll every 15s for new job broadcasts
    refetchIntervalInBackground: false,
  });

  const {
    data: activeJobData,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['worker-active-job'],
    queryFn: getCurrentJob,
    refetchInterval: 15000,       // Poll every 15s to catch status changes
    refetchIntervalInBackground: false,
  });

  // Manual Direct Offers Query (polls frequently)
  const {
    data: manualOffersData,
    refetch: refetchManual,
  } = useQuery({
    queryKey: ['worker-manual-offers'],
    queryFn: getManualOffers,
    enabled: isOnline,
    refetchInterval: 10000,
  });

  // Refetch queries on focus
  useRefreshOnFocus(refetchDash);
  useRefreshOnFocus(refetchJobs);
  useRefreshOnFocus(refetchActive);
  useRefreshOnFocus(refetchManual);

  const stats = dashboardData?.stats ?? { today_earnings: 0, completed_today: 0, rating: 4.8 };
  const availableJobs = availableData?.jobs ?? [];
  const activeJob = dashboardData?.activeJob ? {
    ...dashboardData.activeJob,
    service_items: { name: dashboardData.activeJob.service_name }
  } : null;
  const manualOffers = manualOffersData?.offers ?? [];

  // Sync isOnline switch with database status
  useEffect(() => {
    if (dashboardData) {
      setIsOnline(dashboardData.currentStatus === 'ONLINE');
    }
  }, [dashboardData?.currentStatus]);

  // Audio/Visual Notification Triggers for Platform Web & Browser testing (guarded for native compatibility)
  const playNotificationSound = () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioContextClass = ((window as any).AudioContext || (window as any).webkitAudioContext);
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        
        const playBeep = (delay: number, frequency: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.15);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + 0.15);
        };
        // Double high-pitch chime
        playBeep(0, 880);
        playBeep(0.12, 880);
      }
    } catch (e) {}
  };

  const lastJobIdsRef = useRef<string[]>([]);
  const lastOfferIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (availableJobs.length > 0) {
      const currentIds = availableJobs.map((j: any) => j.id);
      const hasNewJob = currentIds.some((id: string) => !lastJobIdsRef.current.includes(id));
      if (hasNewJob && lastJobIdsRef.current.length > 0) {
        playNotificationSound();
        showAlert(
          'New Job Request!',
          'A new customer booking is available nearby.'
        );
      }
      lastJobIdsRef.current = currentIds;
    } else {
      lastJobIdsRef.current = [];
    }
  }, [availableJobs]);

  useEffect(() => {
    if (manualOffers.length > 0) {
      const currentIds = manualOffers.map(o => o.id);
      const hasNewOffer = currentIds.some(id => !lastOfferIdsRef.current.includes(id));
      if (hasNewOffer && lastOfferIdsRef.current.length > 0) {
        playNotificationSound();
        showAlert(
          'New Direct Offer!',
          'You have received a direct job offer.'
        );
      }
      lastOfferIdsRef.current = currentIds;
    } else {
      lastOfferIdsRef.current = [];
    }
  }, [manualOffers]);

  // Live Location Background Watch
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let lastUpdateEpoch = 0;

    const startTracking = async () => {
      try {
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
            distanceInterval: 15,
          },
          (loc: Location.LocationObject) => {
            if (isCancelled) return;
            const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            setCurrentCoords(coords);

            // Throttle reports to the server once every 20 seconds
            const now = Date.now();
            if (now - lastUpdateEpoch >= 20000) {
              lastUpdateEpoch = now;
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
      } catch (err) {
        console.warn('Live location tracker activation failed:', err);
      }
    };

    if (isOnline) {
      startTracking();
    } else {
      setCurrentCoords(null);
    }

    return () => {
      isCancelled = true;
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
    };
  }, [isOnline]);

  // Toggle Online Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (nextOnline: boolean) => {
      let lat = null;
      let lng = null;
      if (nextOnline) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          }
        } catch (err) {
          console.warn('GPS location fetch rejected during status shift:', err);
        }
      }
      return updateWorkerStatus({
        status: nextOnline ? 'ONLINE' : 'OFFLINE',
        latitude: lat,
        longitude: lng,
      });
    },
    onSuccess: (res, nextOnline) => {
      setIsOnline(nextOnline);
      queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['worker-available-jobs'] });
    },
    onError: (err: any) => {
      Alert.alert('Status Error', err?.response?.data?.error ?? 'Failed to update duty status.');
    },
  });

  // Accept Broadcast Mutation
  const acceptMutation = useMutation({
    mutationFn: acceptJob,
    onSuccess: (res, id) => {
      if (res.success) {
        Alert.alert('Job Accepted', 'Please proceed to the customer address.', [
          {
            text: 'Go to Job',
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['worker-active-job'] });
              queryClient.invalidateQueries({ queryKey: ['worker-available-jobs'] });
              router.push(`/(worker)/jobs/${id}`);
            },
          },
        ]);
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to accept job.');
    },
  });

  // Reject Broadcast Mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectJob(id, 'Not interested'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-available-jobs'] });
      Alert.alert('Declined', 'Job offer declined.');
    },
  });

  // Accept Manual Offer Mutation
  const acceptManualMutation = useMutation({
    mutationFn: acceptManualOffer,
    onSuccess: (res, id) => {
      Alert.alert('Offer Accepted', 'Ready to start your shift.', [
        {
          text: 'Go to Job',
          onPress: () => {
            queryClient.invalidateQueries({ queryKey: ['worker-manual-offers'] });
            queryClient.invalidateQueries({ queryKey: ['worker-active-job'] });
            queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
            router.push(`/(worker)/jobs`);
          },
        },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to accept direct offer.');
    },
  });

  // Reject Manual Offer Mutation
  const rejectManualMutation = useMutation({
    mutationFn: (id: string) => rejectManualOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-manual-offers'] });
      Alert.alert('Declined', 'Direct offer declined.');
    },
  });

  const toggleOnline = () => {
    if (toggleStatusMutation.isPending) return;
    toggleStatusMutation.mutate(!isOnline);
  };

  const { t } = useLanguage();

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-border-primary bg-white shadow-sm">
        <View>
          <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider">
            {t('workerHome.workerPanel')}
          </Text>
          <Text className="text-text-primary text-lg font-extrabold mt-0.5">
            {user?.full_name || 'Partner'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Notifications Bell */}
          <TouchableOpacity
            onPress={() => router.push('/(worker)/notifications')}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-xl bg-background-secondary border border-border-primary justify-center items-center active:bg-slate-100"
          >
            <Ionicons name="notifications-outline" size={18} color="rgb(var(--text-secondary))" />
          </TouchableOpacity>
          {/* Logout */}
          <TouchableOpacity
            onPress={logout}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 justify-center items-center active:bg-danger/20"
          >
            <Ionicons name="log-out-outline" size={18} color="rgb(var(--danger))" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Status switcher */}
        <View className="mb-5">
          <Card variant="default" className="p-5 flex-row justify-between items-center bg-white shadow-premium border-border-primary">
            <View className="flex-row items-center">
              <View className={`w-3.5 h-3.5 rounded-full mr-3 ${isOnline ? 'bg-success border border-success/30' : 'bg-text-muted'}`} />
              <View>
                <Text className="text-text-primary text-sm font-extrabold">{t('workerHome.dutyStatus')}</Text>
                <Text className="text-text-secondary text-[10px] font-semibold mt-0.5">
                  {isOnline ? t('workerHome.receivingJobs') : t('workerHome.youAreOffline')}
                </Text>
              </View>
            </View>
            {toggleStatusMutation.isPending ? (
              <ActivityIndicator size="small" color="rgb(var(--brand-orange))" className="mr-2" />
            ) : (
              <Switch
                value={isOnline}
                onValueChange={toggleOnline}
                trackColor={{ false: '#cbd5e1', true: 'rgba(var(--brand-orange) / 0.2)' }}
                thumbColor={isOnline ? 'rgb(var(--brand-orange))' : '#94a3b8'}
              />
            )}
          </Card>
        </View>

        {/* GPS Telemetry Metadata Strip */}
        {isOnline && (
          <View className="mb-6">
            <Card variant="muted" className="p-4 flex-row flex-wrap justify-between border-border-primary">
              <View className="w-[48%] mb-3">
                <Text className="text-text-muted text-[8px] font-black uppercase tracking-wider">{t('workerHome.trackingState')}</Text>
                <Text className="text-success text-xs font-extrabold mt-0.5">{t('workerHome.activeLocation')}</Text>
              </View>
              <View className="w-[48%] mb-3">
                <Text className="text-text-muted text-[8px] font-black uppercase tracking-wider">{t('workerHome.coordinates')}</Text>
                <Text className="text-text-primary text-xs font-mono font-bold mt-0.5" numberOfLines={1}>
                  {currentCoords ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}` : 'Resolving GPS...'}
                </Text>
              </View>
              <View className="w-[48%]">
                <Text className="text-text-muted text-[8px] font-black uppercase tracking-wider">{t('workerHome.syncQuality')}</Text>
                <Text className="text-primary text-xs font-extrabold mt-0.5">{t('workerHome.highSync')}</Text>
              </View>
              <View className="w-[48%]">
                <Text className="text-text-muted text-[8px] font-black uppercase tracking-wider">{t('workerHome.platformType')}</Text>
                <Text className="text-text-secondary text-xs font-extrabold mt-0.5 uppercase">
                  {Platform.OS === 'web' ? '🌐 WEB' : Platform.OS === 'ios' ? '📱 iOS' : '🤖 Android'}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Stats Grid */}
        <View className="flex-row gap-4 mb-6">
          <View className="flex-1">
            <Card variant="default" className="p-5 border-border-primary">
              <View className="w-8 h-8 rounded-full bg-primary/10 justify-center items-center mb-2">
                <Ionicons name="cash-outline" size={16} color="rgb(var(--primary))" />
              </View>
              <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-1">{t('workerHome.todaysPay')}</Text>
              <Text className="text-text-primary text-xl font-extrabold">{formatCurrency(stats.today_earnings)}</Text>
            </Card>
          </View>
          
          <View className="flex-1">
            <Card variant="default" className="p-5 border-border-primary">
              <View className="w-8 h-8 rounded-full bg-primary-light/10 justify-center items-center mb-2">
                <Ionicons name="checkmark-done-circle-outline" size={18} color="rgb(var(--primary-light))" />
              </View>
              <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-1">{t('workerHome.completed')}</Text>
              <Text className="text-text-primary text-xl font-extrabold">{stats.completed_today} {t('workerHome.jobs')}</Text>
            </Card>
          </View>
        </View>

        {/* Parity Options Grid */}
        <View className="mb-6">
          <Card variant="default" className="p-5 border-border-primary">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-4">{t('workerHome.partnerFeatures')}</Text>
            <View className="flex-row flex-wrap justify-start gap-y-4">
              <TouchableOpacity 
                onPress={() => showAlert(t('workerHome.kycStatusAlert'), `Your verification status is ${dashboardData?.kycStatus || 'PENDING'}.\n\nAadhar, PAN Card, and Selfie uploads are verified.`)} 
                activeOpacity={0.8}
                className="w-1/4 items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-primary-light/10 justify-center items-center border border-primary-light/20 mb-2 shadow-sm">
                  <Ionicons name="shield-checkmark-outline" size={20} color="rgb(var(--primary-light))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">{t('workerHome.kycInfo')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => router.push('/(worker)/jobs')} 
                activeOpacity={0.8}
                className="w-1/4 items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-primary/10 justify-center items-center border border-primary/20 mb-2 shadow-sm">
                  <Ionicons name="receipt-outline" size={20} color="rgb(var(--primary))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">{t('workerHome.jobHistory')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/(worker)/wallet')} 
                activeOpacity={0.8}
                className="w-1/4 items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-brand-orange/10 justify-center items-center border border-brand-orange/20 mb-2 shadow-sm">
                  <Ionicons name="wallet-outline" size={20} color="rgb(var(--brand-orange))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">{t('wallet.title')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => router.push('/(worker)/settlements')} 
                activeOpacity={0.8}
                className="w-1/4 items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-success/10 justify-center items-center border border-success/20 mb-2 shadow-sm">
                  <Ionicons name="card-outline" size={20} color="rgb(var(--success))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">{t('workerHome.settlements')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Active Job Alert */}
        {activeJob ? (
          <TouchableOpacity
            onPress={() => router.push(`/(worker)/jobs/${activeJob.id}`)}
            activeOpacity={0.9}
            className="mb-6"
          >
            <View className="border-l-4 border-l-primary border border-border-primary bg-white rounded-3xl p-5 shadow-premium">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-primary text-[10px] font-black uppercase tracking-wider">
                  {t('workerHome.activeServiceShift')}
                </Text>
                <Badge label={t('workerHome.inProgress')} variant="brand" />
              </View>
              <Text className="text-text-primary text-base font-extrabold mb-2">
                {activeJob.service_items?.name ?? 'Ongoing Service'}
              </Text>
              <Text className="text-text-secondary text-xs mb-4" numberOfLines={1}>
                {activeJob.address_line}
              </Text>
              <Button
                label={t('workerHome.resumeJob')}
                variant="primary"
                size="md"
                onPress={() => router.push(`/(worker)/jobs/${activeJob.id}`)}
              />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Direct Targeted Manual Offers */}
        {isOnline && manualOffers.length > 0 ? (
          <View className="mb-6">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-4">Direct Offers For You</Text>
            {manualOffers.map((offer) => (
              <View key={offer.id} className="mb-4">
                <Card variant="brand-orange" className="p-5 border-brand-orange/20 shadow-premium">
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center">
                        <Badge label="Direct Assignment" variant="brand-orange" size="sm" />
                      </View>
                      <Text className="text-text-primary text-base font-extrabold mt-2 leading-tight">
                        {offer.serviceName}
                      </Text>
                    </View>
                    <OfferTimer expiresAt={offer.expiresAt} onExpire={refetchManual} />
                  </View>

                  {offer.notes ? (
                    <View className="bg-background-secondary p-3 rounded-2xl border border-border-primary mb-3">
                      <Text className="text-text-secondary text-xs italic font-medium" numberOfLines={2}>
                        "{offer.notes}"
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center">
                      <Ionicons name="location-outline" size={14} color="rgb(var(--text-secondary))" />
                      <Text className="text-text-secondary text-xs ml-1 font-bold">{offer.distanceKm} km away</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="cash-outline" size={14} color="rgb(var(--brand-orange))" />
                      <Text className="text-brand-orange text-sm font-black ml-1">Earn: ₹{offer.estimatedEarnings}</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <Button
                      label="Decline"
                      variant="outline"
                      size="sm"
                      disabled={rejectManualMutation.isPending || acceptManualMutation.isPending}
                      onPress={() => rejectManualMutation.mutate(offer.id)}
                      className="flex-1"
                    />
                    <Button
                      label="Accept Direct"
                      variant="brand"
                      size="sm"
                      disabled={rejectManualMutation.isPending || acceptManualMutation.isPending}
                      onPress={() => acceptManualMutation.mutate(offer.id)}
                      className="flex-1"
                    />
                  </View>
                </Card>
              </View>
            ))}
          </View>
        ) : null}

        {/* Available Jobs list */}
        <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-4">Available Jobs Nearby</Text>

        {!isOnline ? (
          <Card variant="muted" className="p-8 items-center border-border-primary mb-10">
            <View className="w-16 h-16 bg-background-secondary rounded-3xl items-center justify-center mb-4 border border-border-primary">
              <Ionicons name="eye-off-outline" size={28} color="rgb(var(--text-muted))" />
            </View>
            <Text className="text-text-primary text-sm font-extrabold text-center mb-1">You are offline</Text>
            <Text className="text-text-secondary text-xs text-center leading-4 max-w-[260px]">
              Go Online to view and accept pending jobs in your service category.
            </Text>
          </Card>
        ) : jobsLoading ? (
          <View className="py-12 justify-center items-center">
            <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
            <Text className="text-text-secondary text-xs mt-2 font-medium">Scanning nearby orders…</Text>
          </View>
        ) : availableJobs.length === 0 ? (
          <Card variant="muted" className="p-8 items-center border-border-primary mb-10">
            <View className="w-16 h-16 bg-background-secondary rounded-3xl items-center justify-center mb-4 border border-border-primary">
              <Ionicons name="search-outline" size={28} color="rgb(var(--text-muted))" />
            </View>
            <Text className="text-text-primary text-sm font-extrabold text-center mb-1">Searching for jobs...</Text>
            <Text className="text-text-secondary text-xs text-center leading-4 max-w-[260px]">
              No pending job offers in your category at this moment. You will be notified when someone books!
            </Text>
          </Card>
        ) : (
          <View className="mb-10">
            {availableJobs.map((job: any) => {
              const createdMs = job.created_at ? new Date(job.created_at).getTime() : Date.now();
              const safeCreatedMs = isNaN(createdMs) ? Date.now() : createdMs;
              const broadcastExpiry = new Date(safeCreatedMs + 5 * 60 * 1000).toISOString();
              return (
                <View key={job.id} className="mb-4">
                  {/* Countdown timer */}
                  <View className="flex-row justify-between items-center px-1 mb-1">
                    <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider">Accept Window</Text>
                    <OfferTimer expiresAt={broadcastExpiry} onExpire={refetchJobs} />
                  </View>
                  <JobCard
                    job={job}
                    onPress={() => router.push(`/(worker)/jobs/${job.id}`)}
                    showActions
                    onAccept={() => acceptMutation.mutate(job.id)}
                    onReject={() => rejectMutation.mutate(job.id)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
