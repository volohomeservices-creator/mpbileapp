import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  Linking,
  Dimensions,
  StyleSheet,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getWorkerDashboard,
  getAvailableJobs,
  acceptJob,
  rejectJob,
  getCurrentJob,
  getManualOffers,
  acceptManualOffer,
  rejectManualOffer,
  getWorkerBanners,
  getInitialCachedWorkerBanners,
} from '@/api/jobs';
import { updateWorkerStatus, pushWorkerLocation } from '@/api/tracking';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { formatCurrency } from '@/utils/formatCurrency';
import { useLanguage } from '@/hooks/useLanguage';
import { BookingStatus } from '@volo/shared-types';
import { getPublicMediaUrl } from '@/utils/media';
import { Skeleton, WorkerHomeSkeleton } from '@/components/ui/Skeleton';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { storage } from '@/utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    return (
      <View className="bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
        <Text className="text-red-600 text-[10px] font-bold">Expired</Text>
      </View>
    );
  }

  return (
    <View className={`px-2 py-0.5 rounded-full border ${timeLeft < 60 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <Text className={`text-[10px] font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-amber-700'}`}>
        ⏰ {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
};

export default function WorkerHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();

  // State
  const [isOnline, setIsOnline] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceCity, setServiceCity] = useState('Hyderabad');
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // Double-tap hardware back button to exit cleanly on Android
  const lastBackPressTime = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPressTime.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPressTime.current = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    storage.getItem('volo_worker_service_city').then((saved) => {
      if (saved) setServiceCity(saved);
    });
  }, []);

  const handleSelectCity = async (city: string) => {
    setServiceCity(city);
    await storage.setItem('volo_worker_service_city', city);
  };

  // Time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

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
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const {
    data: activeJobData,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['worker-active-job'],
    queryFn: getCurrentJob,
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  const {
    data: manualOffersData,
    refetch: refetchManual,
  } = useQuery({
    queryKey: ['worker-manual-offers'],
    queryFn: getManualOffers,
    enabled: isOnline,
    refetchInterval: 10000,
  });

  // Dynamic Real Worker Banners from Database API (/api/worker/banners)
  const {
    data: workerBannersData,
  } = useQuery({
    queryKey: ['worker-active-banners'],
    queryFn: getWorkerBanners,
    initialData: getInitialCachedWorkerBanners,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Focus refetches
  useRefreshOnFocus(refetchDash);
  useRefreshOnFocus(refetchJobs);
  useRefreshOnFocus(refetchActive);
  useRefreshOnFocus(refetchManual);

  const isWorkerHeroPlacement = (p?: string) =>
    p === 'WORKER_HERO' || p === 'ALL_HERO' || p === 'UNIVERSAL_HERO' || p === 'HERO';

  const isWorkerPromoPlacement = (p?: string) =>
    p === 'WORKER_PROMO' || p === 'ALL_PROMO' || p === 'UNIVERSAL_PROMO' || p === 'PROMO';

  const allWorkerBanners = workerBannersData?.banners || [];

  const workerHeroBanner =
    allWorkerBanners.find((b: any) =>
      !b.id?.startsWith('worker-incentive-') && b.active && isWorkerHeroPlacement(b?.placement)
    ) || null;

  const workerPromoBanner =
    allWorkerBanners.find((b: any) =>
      b.active && b.id !== workerHeroBanner?.id && (
        isWorkerPromoPlacement(b?.placement) ||
        b.id?.startsWith('worker-incentive-') ||
        b?.placement === 'WORKER_MOBILE' ||
        b?.placement === 'ALL_MOBILE' ||
        b?.placement === 'ALL'
      )
    ) || null;

  const inStreamWorkerBanner =
    allWorkerBanners.find((b: any) =>
      b.active && b.id !== workerHeroBanner?.id && b.id !== workerPromoBanner?.id
    ) || null;

  const stats = dashboardData?.stats ?? { today_earnings: 0, completed_today: 0, rating: 5.0 };
  const availableJobs = availableData?.jobs ?? [];
  const manualOffers = manualOffersData?.offers ?? [];

  // Active Job resolution from database
  const rawActiveJob = activeJobData?.job || dashboardData?.activeJob || null;
  const activeJob = rawActiveJob
    ? {
      ...rawActiveJob,
      service_name: rawActiveJob.service_name || rawActiveJob.service?.name || rawActiveJob.service_items?.name || 'Home Service',
      customer_name: rawActiveJob.customer?.full_name || rawActiveJob.customer_name || 'Customer',
      customer_phone: rawActiveJob.customer?.phone || rawActiveJob.customer_phone || '',
      address_line: rawActiveJob.address_line || 'Service Address',
      lat: rawActiveJob.lat,
      lng: rawActiveJob.lng,
      image_url: rawActiveJob.service_items?.image_url || rawActiveJob.service_items?.icon_url || rawActiveJob.service?.icon_url,
    }
    : null;

  // Sync isOnline switch with database status
  useEffect(() => {
    if (dashboardData?.currentStatus) {
      setIsOnline(dashboardData.currentStatus === 'ONLINE');
    }
  }, [dashboardData?.currentStatus]);

  // Audio/Visual Notification Triggers for Platform Web & Browser testing
  const playNotificationSound = () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) { }
  };

  const lastJobIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (availableJobs.length > 0) {
      const currentIds = availableJobs.map((j: any) => j.id);
      const hasNewJob = currentIds.some((id: string) => !lastJobIdsRef.current.includes(id));
      if (hasNewJob && lastJobIdsRef.current.length > 0) {
        playNotificationSound();
        showAlert('New Job Request!', 'A new customer booking is available nearby.');
      }
      lastJobIdsRef.current = currentIds;
    } else {
      lastJobIdsRef.current = [];
    }
  }, [availableJobs]);

  // Live Location Background Watch
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let lastUpdateEpoch = 0;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || isCancelled) return;

        // Immediate position fetch for coordinates
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((pos) => {
            if (!isCancelled && pos?.coords) {
              setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          })
          .catch(() => { });

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
            setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });

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
        console.warn('Location tracker error:', err);
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
          console.warn('GPS location fetch error:', err);
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

  const toggleOnline = () => {
    if (toggleStatusMutation.isPending) return;
    if (!isOnline && dashboardData?.kycStatus !== 'APPROVED') {
      Alert.alert(
        'KYC Approval Required',
        'You must complete your KYC verification (Aadhaar, PAN & Bank details) and be approved before you can go online to receive jobs.',
        [
          { text: 'Complete KYC', onPress: () => router.push('/(worker)/kyc' as any) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    toggleStatusMutation.mutate(!isOnline);
  };

  // Open native turn-by-turn navigation
  const handleOpenNavigation = (lat?: number, lng?: number) => {
    if (!lat || !lng) {
      showAlert('Address Notice', 'Customer address coordinates are pending.');
      return;
    }
    const url = Platform.select({
      ios: `maps://?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      showAlert('Navigation Error', 'Could not open native navigation app.');
    });
  };

  const handleCallCustomer = (phone?: string) => {
    if (!phone) {
      showAlert('Phone Notice', 'Customer phone number not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      showAlert('Call Failed', 'Unable to initiate call on this device.');
    });
  };

  // Active Job Stepper index mapping
  const getActiveJobStep = (status: string) => {
    switch (status) {
      case BookingStatus.WORKER_ACCEPTED:
        return 0; // Accepted
      case BookingStatus.ON_THE_WAY:
        return 1; // On the Way
      case BookingStatus.ARRIVED:
        return 2; // Arrived
      case BookingStatus.IN_PROGRESS:
        return 3; // In Progress
      case BookingStatus.COMPLETED:
        return 4; // Completed
      default:
        return 0;
    }
  };

  const activeStepIndex = activeJob ? getActiveJobStep(activeJob.status) : 0;
  const workerFullName = user?.full_name || (dashboardData as any)?.worker?.full_name || 'Captain';
  const cleanFullName = workerFullName.replace(/^captain\s+/i, '').trim();
  const displayCaptainName = cleanFullName ? `Captain ${cleanFullName}` : 'Captain';
  const workerInitial = (cleanFullName || workerFullName).charAt(0).toUpperCase() || 'C';

  // Real profile avatar URL from Supabase storage
  const rawAvatarPath = (user as any)?.avatar_url || (dashboardData as any)?.user?.avatar_url || (dashboardData as any)?.worker?.avatar_url;
  const avatarUrl = getPublicMediaUrl(rawAvatarPath, 'profile-images');

  // Real distance calculation to active job
  const activeDistKm = currentCoords && activeJob?.lat && activeJob?.lng
    ? (Math.sqrt(Math.pow(activeJob.lat - currentCoords.lat, 2) + Math.pow(activeJob.lng - currentCoords.lng, 2)) * 111).toFixed(1)
    : null;
  const activeEtaMins = activeDistKm ? Math.max(2, Math.round(Number(activeDistKm) * 3.5)) : null;

  return (
    <SafeAreaView style={{ backgroundColor: '#FFFFFF' }} className="flex-1" edges={['top']}>
      {/* ========================================================================= */}
      {/* CRISP WHITE TOP NAVIGATION BAR (Matching Customer App) */}
      {/* ========================================================================= */}
      <View className="px-4 py-2 bg-white border-b border-slate-100 flex-row items-center justify-between z-30">
        {/* Left: Brand Logo Image (assets/volo logo 2.png) */}
        <TouchableOpacity
          onPress={() => router.push('/(worker)/home')}
          activeOpacity={0.8}
          className="flex-row items-center py-1"
        >
          <Image
            source={require('../../assets/volo logo 2.png')}
            style={{ width: 92, height: 30 }}
            contentFit="contain"
            contentPosition="left center"
          />
        </TouchableOpacity>

        {/* Center: Location Selector Pill */}
        <TouchableOpacity
          onPress={() => setLocationModalVisible(true)}
          activeOpacity={0.7}
          className="flex-row items-center bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-full active:bg-slate-200"
        >
          <Ionicons name="location-sharp" size={13} color="#7C3AED" style={{ marginRight: 3 }} />
          <Text className="text-slate-800 text-xs font-bold mr-1 max-w-[105px]" numberOfLines={1}>
            {serviceCity}
          </Text>
          <Ionicons name="chevron-down" size={11} color="#64748B" />
        </TouchableOpacity>

        {/* Right: Actions (Notification Bell & Profile Avatar) */}
        <View className="flex-row items-center gap-2">
          {/* Notification Button */}
          <TouchableOpacity
            onPress={() => router.push('/(worker)/notifications')}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200/80 items-center justify-center relative active:bg-slate-200"
          >
            <Ionicons name="notifications-outline" size={18} color="#1E293B" />
            <View className="w-2.5 h-2.5 rounded-full bg-[#EF4444] absolute top-1.5 right-1.5 border-2 border-white" />
          </TouchableOpacity>

          {/* Profile Avatar Button */}
          <TouchableOpacity
            onPress={() => router.push('/(worker)/profile')}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-full overflow-hidden bg-purple-600 border border-purple-200 items-center justify-center active:opacity-90 shadow-sm"
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <Text className="text-white text-xs font-black">
                {workerInitial}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {dashLoading && !dashboardData ? (
        <WorkerHomeSkeleton />
      ) : (
        <ScrollView
          className="flex-1 bg-[#F8F7FC]"
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================================================= */}
          {/* GREETING & DUTY STATUS CARD */}
          {/* ========================================================================= */}
          <View className="mx-4 mt-3 mb-3 bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex-row items-center justify-between">
            {/* Left: Greeting & Captain Name */}
            <View className="flex-1 mr-2.5">
              <View className="flex-row items-center gap-1.5 mb-0.5">
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  {getGreeting()}
                </Text>
                <View className="w-1 h-1 rounded-full bg-slate-300" />
                <Text className="text-purple-600 text-[10px] font-extrabold uppercase tracking-wide">
                  Volo Captain
                </Text>
              </View>
              <Text
                className="text-slate-900 text-lg font-black tracking-tight leading-snug"
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {displayCaptainName}
              </Text>
            </View>

            {/* Right: Modern Duty Status Switch Capsule */}
            <View
              className={`shrink-0 flex-row items-center gap-2 px-2.5 py-1.5 rounded-2xl border ${isOnline
                  ? 'bg-emerald-50/90 border-emerald-200'
                  : 'bg-slate-100/90 border-slate-200'
                }`}
            >
              <View className="items-start">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  />
                  <Text
                    className={`text-xs font-black ${isOnline ? 'text-emerald-800' : 'text-slate-700'}`}
                  >
                    {isOnline ? 'Available' : 'Offline'}
                  </Text>
                </View>
                <Text
                  className={`text-[9px] font-bold mt-0.5 ${isOnline ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {isOnline ? 'Ready for jobs' : 'Not receiving'}
                </Text>
              </View>

              {toggleStatusMutation.isPending ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Switch
                  value={isOnline}
                  onValueChange={toggleOnline}
                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#CBD5E1"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              )}
            </View>
          </View>

          {/* ⚠️ KYC Action Required Banner (When not approved) */}
          {dashboardData?.kycStatus !== 'APPROVED' && (
            <TouchableOpacity
              onPress={() => router.push('/(worker)/kyc' as any)}
              activeOpacity={0.9}
              className="mx-4 mb-3.5 rounded-2xl p-4 shadow-sm border border-amber-300 flex-row items-center gap-3.5"
              style={{ backgroundColor: '#FEF3C7' }}
            >
              <View className="w-10 h-10 rounded-xl bg-amber-500 items-center justify-center shrink-0 shadow-2xs">
                <Ionicons name="shield-outline" size={22} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-950 text-xs font-black uppercase tracking-wider">
                  KYC Verification Required
                </Text>
                <Text className="text-amber-800 text-[11px] font-semibold mt-0.5 leading-snug">
                  Upload Aadhaar, PAN & bank details to go online and accept bookings.
                </Text>
              </View>
              <View className="bg-amber-500 px-3 py-1.5 rounded-xl shrink-0">
                <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                  Verify &gt;
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 🌟 HERO ANNOUNCEMENT BANNER (Clean In-Stream Card) */}
          {workerHeroBanner && (
            <View className="mx-4 mb-3">
              <TouchableOpacity
                activeOpacity={workerHeroBanner.action_url ? 0.9 : 1}
                onPress={() => {
                  if (workerHeroBanner.action_url) {
                    router.push(workerHeroBanner.action_url as any);
                  }
                }}
                className="bg-[#1E0B4B] rounded-2xl overflow-hidden p-4 border border-purple-800/40 shadow-sm relative min-h-[110px] justify-center"
              >
                {workerHeroBanner.image_url ? (
                  <>
                    <Image
                      source={{ uri: workerHeroBanner.image_url }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                      contentFit="cover"
                      contentPosition={(workerHeroBanner.image_position as any) || 'center'}
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                    <LinearGradient
                      colors={['rgba(24, 7, 62, 0.94)', 'rgba(24, 7, 62, 0.68)', 'rgba(24, 7, 62, 0.2)']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </>
                ) : (
                  <LinearGradient
                    colors={['rgba(30, 11, 75, 0.95)', 'rgba(49, 14, 116, 0.95)']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View className="relative z-10 max-w-[85%]">
                  <View className="bg-amber-400/20 border border-amber-300/30 px-2.5 py-0.5 rounded-full self-start mb-1.5 flex-row items-center gap-1">
                    <Ionicons name="sparkles" size={10} color="#FBBF24" />
                    <Text className="text-amber-200 text-[9px] font-black uppercase tracking-wider">
                      {workerHeroBanner.discount_label || 'CAPTAIN UPDATE'}
                    </Text>
                  </View>
                  <Text className="text-white text-base font-black leading-snug">
                    {workerHeroBanner.title}
                  </Text>
                  {workerHeroBanner.subtitle ? (
                    <Text className="text-white/80 text-xs font-medium mt-1 leading-relaxed" numberOfLines={2}>
                      {workerHeroBanner.subtitle}
                    </Text>
                  ) : null}
                  {workerHeroBanner.button_text ? (
                    <View className="bg-emerald-500 px-3.5 py-1.5 rounded-full self-start flex-row items-center gap-1 mt-2.5 shadow-xs">
                      <Text className="text-slate-950 text-xs font-black">
                        {workerHeroBanner.button_text}
                      </Text>
                      <Ionicons name="arrow-forward" size={12} color="#022c22" />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================================= */}
          {/* MAIN DASHBOARD CONTENT */}
          {/* ========================================================================= */}
          <View className="px-4 pt-4">

            {/* TODAY'S EARNINGS CARD */}
            <View className="bg-[#18073E] rounded-[24px] p-5 border border-purple-800/40 shadow-xl mb-4 relative overflow-hidden">
              <LinearGradient
                colors={['#18073E', '#2A0C6B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />

              {/* Card Header */}
              <View className="flex-row items-center justify-between mb-2 z-10">
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/wallet')}
                  activeOpacity={0.8}
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-white/80 text-xs font-bold">Today's Earnings</Text>
                  <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(worker)/wallet')}
                  activeOpacity={0.8}
                  className="bg-white/10 px-3 py-1 rounded-full border border-white/15 flex-row items-center gap-1 active:bg-white/20"
                >
                  <Text className="text-white text-[11px] font-bold">View Earnings</Text>
                  <Ionicons name="chevron-forward" size={10} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Main Metric & Split */}
              <View className="flex-row items-center justify-between z-10 mt-1">
                {/* Real Earnings Amount */}
                <View>
                  <Text className="text-white text-3xl font-black tracking-tight">
                    {formatCurrency(stats.today_earnings ?? 0)}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-1">
                    <Ionicons name="flash" size={12} color="#10B981" />
                    <Text className="text-emerald-400 text-xs font-bold">Duty Payout</Text>
                    <Text className="text-white/60 text-xs font-medium">• Live today</Text>
                  </View>
                </View>

                {/* Three Metric Dividers with Real Counts */}
                <View className="flex-row items-center gap-4 border-l border-white/15 pl-4">
                  {/* Total */}
                  <View className="items-center">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="briefcase-outline" size={12} color="rgba(255,255,255,0.7)" />
                      <Text className="text-white text-base font-black">
                        {dashboardData?.todayJobsCount ?? stats.completed_today ?? 0}
                      </Text>
                    </View>
                    <Text className="text-white/60 text-[9px] font-bold mt-0.5">Total Jobs</Text>
                  </View>

                  {/* Completed */}
                  <View className="items-center">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle-outline" size={12} color="#10B981" />
                      <Text className="text-white text-base font-black">
                        {stats.completed_today ?? 0}
                      </Text>
                    </View>
                    <Text className="text-white/60 text-[9px] font-bold mt-0.5">Completed</Text>
                  </View>

                  {/* In Progress */}
                  <View className="items-center">
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="time-outline" size={12} color="#F59E0B" />
                      <Text className="text-white text-base font-black">
                        {activeJob ? 1 : (dashboardData?.pendingJobsCount ?? 0)}
                      </Text>
                    </View>
                    <Text className="text-white/60 text-[9px] font-bold mt-0.5">In Progress</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 🎁 2. DYNAMIC WORKER PROMO / INCENTIVE BANNER (Below Earnings Card) */}
            {workerPromoBanner && (
              <TouchableOpacity
                activeOpacity={workerPromoBanner.action_url ? 0.88 : 1}
                onPress={() => {
                  if (workerPromoBanner.action_url) {
                    router.push(workerPromoBanner.action_url as any);
                  }
                }}
                style={{
                  backgroundColor: workerPromoBanner.background_color || '#130438',
                  borderRadius: 24,
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: 140,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(147, 51, 234, 0.3)',
                  justifyContent: 'center',
                }}
              >
                {workerPromoBanner.image_url && (
                  <>
                    <Image
                      source={{ uri: workerPromoBanner.image_url }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100%',
                        height: '100%',
                      }}
                      contentFit="cover"
                      contentPosition={(workerPromoBanner.image_position as any) || 'center'}
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                    <LinearGradient
                      colors={workerPromoBanner.title ? ['rgba(19, 4, 56, 0.92)', 'rgba(19, 4, 56, 0.65)', 'rgba(19, 4, 56, 0.2)'] : ['transparent', 'transparent']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </>
                )}
                <View style={{ position: 'relative', zIndex: 10, maxWidth: '100%' }}>
                  <View className="bg-emerald-500/25 border border-emerald-400/30 px-2.5 py-0.5 rounded-full self-start mb-1.5 flex-row items-center gap-1 backdrop-blur-md">
                    <Ionicons name="flash" size={10} color="#34D399" />
                    <Text className="text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                      {workerPromoBanner.discount_label || 'CAPTAIN INCENTIVE'}
                    </Text>
                  </View>
                  <Text
                    className="text-white text-base font-black leading-tight"
                    style={{
                      textShadowColor: 'rgba(0, 0, 0, 0.85)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 4,
                    }}
                    numberOfLines={2}
                  >
                    {workerPromoBanner.title}
                  </Text>
                  <Text
                    className="text-white/90 text-[11px] font-medium mt-1 leading-snug"
                    style={{
                      textShadowColor: 'rgba(0, 0, 0, 0.85)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                    numberOfLines={2}
                  >
                    {workerPromoBanner.subtitle}
                  </Text>
                  {workerPromoBanner.action_url && (
                    <View className="self-start mt-2.5 bg-emerald-500 px-3 py-1 rounded-full flex-row items-center gap-1 shadow-sm">
                      <Text className="text-slate-950 text-[10px] font-black">
                        {workerPromoBanner.button_text || 'View Opportunity'}
                      </Text>
                      <Ionicons name="arrow-forward" size={10} color="#020617" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* GPS TELEMETRY STATUS INDICATOR */}
            {isOnline && (
              <View className="flex-row items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 mb-4 shadow-xs">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-slate-800 text-xs font-bold">
                    Location Tracking Active
                  </Text>
                </View>
                <Text className="text-slate-400 text-[10px] font-medium">
                  High-Accuracy GPS • Live
                </Text>
              </View>
            )}

            {/* ========================================================================= */}
            {/* ACTIVE JOB COMPONENT (Dominant Component When Job Exists) */}
            {/* ========================================================================= */}
            {activeJob ? (
              <View className="bg-white rounded-[24px] p-5 border border-purple-200/90 shadow-premium mb-4">
                {/* Active Job Header */}
                <View className="flex-row items-center justify-between mb-3.5">
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <Text className="text-slate-900 text-xs font-black uppercase tracking-wider">
                      ACTIVE JOB
                    </Text>
                  </View>

                  <View className="bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-[#3C01A7]" />
                    <Text className="text-[#3C01A7] text-[10px] font-extrabold uppercase tracking-wide">
                      {activeJob.status?.replace(/_/g, ' ') || 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Job Details Card Top Body */}
                <TouchableOpacity
                  onPress={() => router.push(`/(worker)/jobs/${activeJob.id}`)}
                  activeOpacity={0.88}
                  className="flex-row items-center justify-between pb-3.5 border-b border-slate-100"
                >
                  {/* Service Category Thumbnail from Real Database Image */}
                  <View className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 items-center justify-center mr-3.5 overflow-hidden">
                    {activeJob.image_url ? (
                      <Image
                        source={{ uri: getPublicMediaUrl(activeJob.image_url, 'service-images') || activeJob.image_url }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons name="construct" size={24} color="#3C01A7" />
                    )}
                  </View>

                  {/* Real Information Column */}
                  <View className="flex-1 mr-2">
                    <Text className="text-slate-900 text-sm font-extrabold" numberOfLines={1}>
                      {activeJob.service_name}
                    </Text>
                    <Text className="text-slate-600 text-xs font-semibold mt-0.5">
                      {activeJob.customer_name}
                    </Text>

                    <View className="flex-row items-center gap-1 mt-1">
                      <Ionicons name="location-outline" size={12} color="#64748B" />
                      <Text className="text-slate-500 text-[11px] font-medium" numberOfLines={1}>
                        {activeJob.address_line}
                      </Text>
                    </View>

                    {activeDistKm ? (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Ionicons name="navigate-outline" size={11} color="#6D28D9" />
                        <Text className="text-purple-700 text-[10px] font-bold">
                          ~{activeDistKm} km away • ETA {activeEtaMins} min
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Ionicons name="navigate-outline" size={11} color="#6D28D9" />
                        <Text className="text-purple-700 text-[10px] font-bold">
                          Customer Destination
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Right Arrow to Open Job */}
                  <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                    <Ionicons name="chevron-forward" size={16} color="#64748B" />
                  </View>
                </TouchableOpacity>

                {/* Progress Stepper */}
                <View className="py-4">
                  <View className="flex-row items-center justify-between relative">
                    {[
                      { label: 'Accepted', icon: 'checkmark' },
                      { label: 'On the Way', icon: 'car' },
                      { label: 'Arrived', icon: 'location' },
                      { label: 'In Progress', icon: 'construct' },
                      { label: 'Completed', icon: 'checkmark-done' },
                    ].map((step, idx) => {
                      const isPassed = activeStepIndex > idx;
                      const isCurrent = activeStepIndex === idx;

                      return (
                        <View key={idx} className="items-center flex-1 z-10">
                          <View
                            className={`w-7 h-7 rounded-full items-center justify-center border-2 ${isCurrent
                              ? 'bg-[#3C01A7] border-[#3C01A7] shadow-sm'
                              : isPassed
                                ? 'bg-purple-600 border-purple-600'
                                : 'bg-white border-slate-200'
                              }`}
                          >
                            <Ionicons
                              name={isPassed ? 'checkmark' : (step.icon as any)}
                              size={12}
                              color={isPassed || isCurrent ? 'white' : '#94A3B8'}
                            />
                          </View>
                          <Text
                            className={`text-[8.5px] mt-1 font-bold text-center ${isCurrent
                              ? 'text-[#3C01A7] font-extrabold'
                              : isPassed
                                ? 'text-purple-700'
                                : 'text-slate-400'
                              }`}
                            numberOfLines={1}
                          >
                            {step.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Prominent Quick Action Buttons */}
                <View className="flex-row gap-3 pt-1">
                  {/* Navigation Button */}
                  <TouchableOpacity
                    onPress={() => handleOpenNavigation(activeJob.lat, activeJob.lng)}
                    activeOpacity={0.88}
                    className="flex-1 h-12 rounded-2xl bg-[#3C01A7] flex-row items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
                  >
                    <Ionicons name="navigate-outline" size={16} color="white" />
                    <Text className="text-white text-xs font-extrabold">Open Navigation</Text>
                  </TouchableOpacity>

                  {/* Call Customer Button */}
                  <TouchableOpacity
                    onPress={() => handleCallCustomer(activeJob.customer_phone)}
                    activeOpacity={0.88}
                    className="flex-1 h-12 rounded-2xl bg-white border border-slate-200 flex-row items-center justify-center gap-2 active:bg-slate-50"
                  >
                    <Ionicons name="call" size={16} color="#059669" />
                    <Text className="text-slate-800 text-xs font-extrabold">Call Customer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* DIRECT TARGETED MANUAL OFFERS (If Present) */}
            {isOnline && manualOffers.length > 0 && (
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2 px-1">
                  <Text className="text-slate-900 text-xs font-black uppercase tracking-wider">
                    Direct Assignment For You
                  </Text>
                  <View className="bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                    <Text className="text-purple-800 text-[10px] font-bold">Exclusive</Text>
                  </View>
                </View>

                {manualOffers.map((offer) => (
                  <View
                    key={offer.id}
                    className="bg-white rounded-[22px] p-4 border border-amber-300 shadow-sm mb-3"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-slate-900 text-sm font-extrabold">
                          {offer.serviceName}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          📍 {offer.distanceKm} km away
                        </Text>
                      </View>
                      <OfferTimer expiresAt={offer.expiresAt} onExpire={refetchManual} />
                    </View>

                    <View className="flex-row items-center justify-between py-2 border-t border-slate-100 my-1">
                      <Text className="text-slate-600 text-xs font-semibold">Net Payout</Text>
                      <Text className="text-emerald-700 text-sm font-black">
                        ₹{offer.estimatedEarnings}
                      </Text>
                    </View>

                    <View className="flex-row gap-2 mt-2">
                      <TouchableOpacity
                        onPress={() => rejectManualOffer(offer.id)}
                        activeOpacity={0.8}
                        className="flex-1 h-10 rounded-xl bg-slate-100 items-center justify-center"
                      >
                        <Text className="text-slate-600 text-xs font-bold">Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => acceptManualOffer(offer.id)}
                        activeOpacity={0.85}
                        className="flex-1 h-10 rounded-xl bg-[#3C01A7] items-center justify-center"
                      >
                        <Text className="text-white text-xs font-bold">Accept Offer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ========================================================================= */}
            {/* QUICK ACTIONS GRID */}
            {/* ========================================================================= */}
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3 px-1">
                <Text className="text-slate-900 text-xs font-black uppercase tracking-wider">
                  QUICK ACTIONS
                </Text>
                <TouchableOpacity onPress={() => router.push('/(worker)/jobs')} activeOpacity={0.8}>
                  <Text className="text-[#3C01A7] text-xs font-bold">See all &gt;</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between gap-3">
                {/* 1. KYC Info */}
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/kyc' as any)}
                  activeOpacity={0.8}
                  className="flex-1 bg-white p-3 rounded-[20px] border border-slate-200/80 items-center shadow-xs active:scale-95"
                >
                  <View className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 items-center justify-center mb-2">
                    <Ionicons name="shield-checkmark" size={22} color="#7C3AED" />
                  </View>
                  <Text className="text-slate-800 text-[11px] font-bold text-center">KYC Info</Text>
                </TouchableOpacity>

                {/* 2. Job History */}
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/jobs')}
                  activeOpacity={0.8}
                  className="flex-1 bg-white p-3 rounded-[20px] border border-slate-200/80 items-center shadow-xs active:scale-95"
                >
                  <View className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center mb-2">
                    <Ionicons name="document-text" size={22} color="#2563EB" />
                  </View>
                  <Text className="text-slate-800 text-[11px] font-bold text-center">Job History</Text>
                </TouchableOpacity>

                {/* 3. My Wallet */}
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/wallet')}
                  activeOpacity={0.8}
                  className="flex-1 bg-white p-3 rounded-[20px] border border-slate-200/80 items-center shadow-xs active:scale-95"
                >
                  <View className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 items-center justify-center mb-2">
                    <Ionicons name="wallet" size={22} color="#D97706" />
                  </View>
                  <Text className="text-slate-800 text-[11px] font-bold text-center">My Wallet</Text>
                </TouchableOpacity>

                {/* 4. Settlements */}
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/settlements')}
                  activeOpacity={0.8}
                  className="flex-1 bg-white p-3 rounded-[20px] border border-slate-200/80 items-center shadow-xs active:scale-95"
                >
                  <View className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 items-center justify-center mb-2">
                    <Ionicons name="card" size={22} color="#059669" />
                  </View>
                  <Text className="text-slate-800 text-[11px] font-bold text-center">Settlements</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 🌟 In-Stream Captain Promotional / Announcement Banner */}
            {(inStreamWorkerBanner || (!workerPromoBanner && allWorkerBanners.length > 0 ? allWorkerBanners[0] : null)) && (
              <View className="mb-4">
                {(() => {
                  const b = inStreamWorkerBanner || (allWorkerBanners.length > 0 ? allWorkerBanners[0] : null);
                  if (!b || b.id === workerHeroBanner?.id) return null;
                  return (
                    <TouchableOpacity
                      activeOpacity={b.action_url ? 0.88 : 1}
                      onPress={() => {
                        if (b.action_url) {
                          router.push(b.action_url as any);
                        }
                      }}
                      style={{
                        backgroundColor: b.background_color || '#130438',
                        borderRadius: 22,
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: 115,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(147, 51, 234, 0.25)',
                        justifyContent: 'center',
                      }}
                    >
                      {b.image_url ? (
                        <>
                          <Image
                            source={{ uri: b.image_url }}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              width: '100%',
                              height: '100%',
                            }}
                            contentFit="cover"
                            contentPosition={(b.image_position as any) || 'center'}
                            cachePolicy="memory-disk"
                            transition={200}
                          />
                          <LinearGradient
                            colors={b.title ? ['rgba(19, 4, 56, 0.92)', 'rgba(19, 4, 56, 0.65)', 'rgba(19, 4, 56, 0.2)'] : ['transparent', 'transparent']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={StyleSheet.absoluteFill}
                          />
                        </>
                      ) : null}
                      <View style={{ position: 'relative', zIndex: 10, maxWidth: '85%' }}>
                        <View className="bg-emerald-500/25 border border-emerald-400/30 px-2.5 py-0.5 rounded-full self-start mb-1 flex-row items-center gap-1 backdrop-blur-md">
                          <Ionicons name="sparkles" size={10} color="#34D399" />
                          <Text className="text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                            {b.discount_label || 'CAPTAIN ANNOUNCEMENT'}
                          </Text>
                        </View>
                        <Text className="text-white text-sm font-black leading-tight" numberOfLines={2}>
                          {b.title}
                        </Text>
                        {b.subtitle ? (
                          <Text className="text-white/80 text-[11px] font-medium mt-0.5 leading-snug" numberOfLines={2}>
                            {b.subtitle}
                          </Text>
                        ) : null}
                        {b.button_text ? (
                          <View className="self-start mt-2 bg-emerald-500 px-3 py-1 rounded-full flex-row items-center gap-1 shadow-sm">
                            <Text className="text-slate-950 text-[10px] font-black">{b.button_text}</Text>
                            <Ionicons name="arrow-forward" size={10} color="#020617" />
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}

            {/* ========================================================================= */}
            {/* JOBS NEAR YOU / AVAILABLE JOBS */}
            {/* ========================================================================= */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-3 px-1">
                <Text className="text-slate-900 text-xs font-black uppercase tracking-wider">
                  JOBS NEAR YOU
                </Text>
                <TouchableOpacity onPress={() => router.push('/(worker)/jobs')} activeOpacity={0.8}>
                  <Text className="text-[#3C01A7] text-xs font-bold">See all &gt;</Text>
                </TouchableOpacity>
              </View>

              {!isOnline ? (
                <View className="bg-white rounded-[22px] p-6 items-center border border-slate-200/80 shadow-xs mb-4">
                  <View className="w-14 h-14 rounded-2xl bg-slate-100 items-center justify-center mb-3">
                    <Ionicons name="eye-off-outline" size={26} color="#94A3B8" />
                  </View>
                  <Text className="text-slate-800 text-sm font-extrabold text-center mb-1">
                    You are Currently Offline
                  </Text>
                  <Text className="text-slate-500 text-xs text-center max-w-[260px] leading-4">
                    Turn your status Online above to view and accept incoming job requests in your locality.
                  </Text>
                </View>
              ) : jobsLoading ? (
                <View className="bg-white rounded-[22px] p-8 items-center border border-slate-200/80 shadow-xs mb-4">
                  <ActivityIndicator size="small" color="#3C01A7" />
                  <Text className="text-slate-500 text-xs font-semibold mt-2.5">
                    Scanning for nearby job orders...
                  </Text>
                </View>
              ) : availableJobs.length === 0 ? (
                <View className="bg-white rounded-[22px] p-6 items-center border border-slate-200/80 shadow-xs mb-4">
                  <View className="w-14 h-14 rounded-2xl bg-purple-50 items-center justify-center mb-3 border border-purple-100">
                    <Ionicons name="radio-outline" size={26} color="#3C01A7" />
                  </View>
                  <Text className="text-slate-900 text-sm font-extrabold text-center mb-1">
                    No New Jobs Nearby
                  </Text>
                  <Text className="text-slate-500 text-xs text-center max-w-[270px] leading-4.5">
                    You are available for jobs. You will receive an instant notification as soon as a new booking is requested.
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {availableJobs.map((job: any) => {
                    const estEarning = job.estimated_earnings || (job.total_amount ? (job.total_amount * 0.85).toFixed(0) : 0);
                    const jobImgUrl = getPublicMediaUrl(job.service?.icon_url || job.service_items?.icon_url, 'service-images');
                    const formattedTime = job.scheduled_at
                      ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : job.created_at
                        ? new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Flexible Time';

                    return (
                      <TouchableOpacity
                        key={job.id}
                        onPress={() => router.push(`/(worker)/jobs/${job.id}`)}
                        activeOpacity={0.88}
                        className="bg-white rounded-[22px] p-4 border border-slate-200/90 shadow-sm flex-row items-center justify-between"
                      >
                        {/* Left: Real Service Thumbnail or Category Icon */}
                        <View className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 items-center justify-center mr-3 overflow-hidden">
                          {jobImgUrl ? (
                            <Image
                              source={{ uri: jobImgUrl }}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />
                          ) : (
                            <Ionicons name="construct" size={22} color="#3C01A7" />
                          )}
                        </View>

                        {/* Center: Real Details */}
                        <View className="flex-1 mr-2">
                          <Text className="text-slate-900 text-xs font-extrabold" numberOfLines={1}>
                            {job.service?.name || job.service_name || 'Home Service'}
                          </Text>
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Ionicons name="location-outline" size={11} color="#64748B" />
                            <Text className="text-slate-500 text-[10px] font-medium" numberOfLines={1}>
                              {job.locality || job.address_line || 'Nearby Customer'}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Ionicons name="time-outline" size={11} color="#64748B" />
                            <Text className="text-slate-500 text-[10px] font-medium">
                              {formattedTime}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <Ionicons name="navigate-outline" size={10} color="#6D28D9" />
                            <Text className="text-purple-700 text-[10px] font-bold">
                              {job.distance_km ? `${job.distance_km} km away` : 'Nearby'}
                            </Text>
                          </View>
                        </View>

                        {/* Right: Real Earning */}
                        <View className="items-end">
                          <Text className="text-slate-900 text-base font-black">
                            {formatCurrency(Number(estEarning))}
                          </Text>
                          <Text className="text-slate-400 text-[9px] font-semibold">
                            Est. Earning
                          </Text>
                          <View className="w-6 h-6 rounded-full bg-slate-100 items-center justify-center mt-1">
                            <Ionicons name="chevron-forward" size={13} color="#64748B" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}
      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        currentCity={serviceCity}
        onSelectCity={handleSelectCity}
        title="Operating City"
        subtitle="Select the city where you are available to accept jobs"
      />
    </SafeAreaView>
  );
}
