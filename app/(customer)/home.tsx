import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getServices, getActiveBookings, getActiveBanners, getBookingHistory } from '@/api/bookings';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useLanguage } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// Platform-resilient alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Location State
  const [locationName, setLocationName] = useState(t('customerHome.detectingLocation'));

  // Track previous booking statuses to detect changes and fire alerts
  const prevBookingStatusesRef = useRef<Record<string, string>>({});
  const isFirstLoadRef = useRef(true);

  // Queries
  const {
    data: servicesData,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ['customer-services'],
    queryFn: getServices,
  });

  const {
    data: activeBookingsData,
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['customer-active-bookings'],
    queryFn: getActiveBookings,
    refetchInterval: 10_000,        // Poll every 10s to detect status changes
    refetchIntervalInBackground: false,
  });

  // Fire in-app alerts when booking status changes are detected
  useEffect(() => {
    if (!activeBookingsData?.bookings) return;

    const currentBookings = activeBookingsData.bookings;

    if (isFirstLoadRef.current) {
      // On first load, just snapshot statuses — don't fire alerts
      const snapshot: Record<string, string> = {};
      currentBookings.forEach((b: any) => { snapshot[b.id] = b.status; });
      prevBookingStatusesRef.current = snapshot;
      isFirstLoadRef.current = false;
      return;
    }

    currentBookings.forEach((booking: any) => {
      const prevStatus = prevBookingStatusesRef.current[booking.id];
      const newStatus = booking.status;

      if (prevStatus && prevStatus !== newStatus) {
        const alertConfig: Record<string, { title: string; message: string } | null> = {
          WORKER_ASSIGNED: { title: t('bookingAlerts.workerAssigned'), message: t('bookingAlerts.workerAssignedMsg') },
          WORKER_ACCEPTED: { title: t('bookingAlerts.workerConfirmed'), message: t('bookingAlerts.workerConfirmedMsg') },
          ON_THE_WAY: { title: t('bookingAlerts.workerOnWay'), message: t('bookingAlerts.workerOnWayMsg') },
          ARRIVED: { title: t('bookingAlerts.workerArrived'), message: t('bookingAlerts.workerArrivedMsg') },
          IN_PROGRESS: { title: t('bookingAlerts.serviceInProgress'), message: t('bookingAlerts.serviceInProgressMsg') },
          COMPLETED: { title: t('bookingAlerts.serviceCompleted'), message: t('bookingAlerts.serviceCompletedMsg') },
          CANCELLED: { title: t('bookingAlerts.bookingCancelled'), message: t('bookingAlerts.bookingCancelledMsg') },
        };
        const cfg = alertConfig[newStatus];
        if (cfg) {
          const serviceName = booking.service_items?.name || t('bookingAlerts.serviceLabel');
          showAlert(cfg.title, `${cfg.message}\n\n${t('bookingAlerts.serviceLabel')}: ${serviceName}`);
        }
      }

      // Always update snapshot
      prevBookingStatusesRef.current[booking.id] = newStatus;
    });
  }, [activeBookingsData]);

  const {
    data: bannersData,
    refetch: refetchBanners,
  } = useQuery({
    queryKey: ['customer-active-banners'],
    queryFn: getActiveBanners,
  });

  const {
    data: historyData,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['customer-booking-history-home'],
    queryFn: getBookingHistory,
  });

  const unreviewedBooking = historyData?.bookings?.find((b: any) => {
    if (b.status !== 'COMPLETED') return false;
    const rawReview = b.reviews;
    const review = Array.isArray(rawReview) ? (rawReview[0] || null) : (rawReview || null);
    return !review;
  });

  // Dynamic Location reverse-geocoding
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('Permission denied, Bangalore');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        let reverseName = '';

        if (Platform.OS === 'web') {
          // Fallback to OpenStreetMap Nominatim reverse geocoding on Web (expo-location doesn't support web geocoding)
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${location.coords.latitude}&lon=${location.coords.longitude}&format=json`;
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'VoloHomeServices/1.0 (contact@volo.com)'
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const addr = data.address;
              reverseName = [
                addr.suburb || addr.neighbourhood || addr.village || addr.road,
                addr.city || addr.town || addr.county
              ]
                .filter(Boolean)
                .join(', ');
            }
          }
        } else {
          // Native reverse geocoding for iOS / Android
          const reverse = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          if (reverse && reverse.length > 0) {
            const first = reverse[0];
            reverseName = [first.district || first.name, first.city || first.subregion]
              .filter(Boolean)
              .join(', ');
          }
        }

        setLocationName(reverseName || 'Detected Location');
      } catch (e) {
        console.error('Location error:', e);
        setLocationName('Indiranagar, Bangalore');
      }
    })();
  }, []);

  // Refetch when focused
  useRefreshOnFocus(refetchBookings);
  useRefreshOnFocus(refetchServices);
  useRefreshOnFocus(refetchBanners);
  useRefreshOnFocus(refetchHistory);

  const activeBookings = activeBookingsData?.bookings ?? [];
  const categories = servicesData?.categories ?? [];

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: '/(customer)/bookings/create',
      params: { categoryId },
    });
  };

  const getCategoryIcon = (name: string) => {
    const cleanName = name.toLowerCase();
    if (cleanName.includes('clean')) return 'vacuum';
    if (cleanName.includes('plumb')) return 'water-pump';
    if (cleanName.includes('electric')) return 'power-plug';
    if (cleanName.includes('carpenter') || cleanName.includes('wood')) return 'hammer';
    if (cleanName.includes('ac') || cleanName.includes('air')) return 'air-conditioner';
    if (cleanName.includes('ro') || cleanName.includes('water')) return 'filter';
    if (cleanName.includes('pest')) return 'bug';
    if (cleanName.includes('paint')) return 'paint-roller';
    if (cleanName.includes('legal')) return 'gavel';
    return 'hammer';
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Location Header */}
      <View className="px-6 pt-5 pb-3 flex-row justify-between items-center bg-white">
        <View className="flex-row items-center flex-1 mr-4">
          <Ionicons name="location-sharp" size={16} color="rgb(var(--primary))" />
          <Text className="text-text-primary text-xs font-black ml-1.5 underline leading-5" numberOfLines={1}>
            {locationName}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(customer)/notifications')}
          activeOpacity={0.8}
          className="w-9 h-9 justify-center items-center active:scale-95 bg-background-secondary border border-border-primary rounded-full"
        >
          <Ionicons name="notifications-outline" size={18} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
      </View>

      {/* Unified Search Bar */}
      <View className="px-6 py-3 bg-white mb-2">
        <View className="flex-row items-center bg-background-secondary border border-border-primary rounded-2xl px-4 h-12">
          <Ionicons name="search-outline" size={16} color="rgb(var(--text-secondary))" className="mr-2.5" />
          <TextInput
            className="flex-1 text-text-primary text-sm h-full font-semibold"
            placeholder={t('customerHome.searchPlaceholder')}
            placeholderTextColor="rgb(var(--text-muted))"
            editable={false}
          />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section Banner */}
        <View 
          style={{ backgroundColor: '#4f46e5' }}
          className="mx-6 mb-6 rounded-3xl shadow-premium relative overflow-hidden mt-2 h-36"
        >
          <Image
            source={require('../../assets/home_services_banner.png')}
            style={{ position: 'absolute', right: 0, bottom: 0, width: '100%', height: '100%' }}
            contentFit="cover"
          />
          <View className="flex-1 p-6 justify-center bg-indigo-950/20 z-10">
            <Text className="text-white text-base font-extrabold leading-5 mb-1.5">
              {t('customerHome.heroTitle')}
            </Text>
            <Text className="text-white/85 text-[10px] font-semibold leading-4 max-w-[190px]">
              {t('customerHome.heroSubtitle')}
            </Text>
          </View>
        </View>

        {/* Dynamic Rate Your Service Prompt Card */}
        {unreviewedBooking ? (
          <View className="mx-6 mb-6">
            <Card variant="brand" className="p-5 border-primary/20 bg-primary/5">
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-2">
                  <Text className="text-primary text-[10px] font-black uppercase tracking-wider">Rate Your Service</Text>
                  <Text className="text-text-primary text-sm font-extrabold mt-1">
                    How was your {unreviewedBooking.service_items?.name || 'service'}?
                  </Text>
                  {unreviewedBooking.workers?.users?.full_name ? (
                    <Text className="text-text-secondary text-xs mt-0.5 font-semibold">
                      Help us grade {unreviewedBooking.workers.users.full_name}'s work.
                    </Text>
                  ) : null}
                </View>
                <View className="w-10 h-10 bg-primary/10 rounded-2xl items-center justify-center">
                  <Ionicons name="star" size={20} color="rgb(var(--primary))" />
                </View>
              </View>
              <Button
                label="Rate Job Now"
                variant="primary"
                size="sm"
                onPress={() => {
                  router.push({
                    pathname: '/(customer)/bookings',
                    params: { openReview: unreviewedBooking.id }
                  });
                }}
                className="mt-3 w-full"
              />
            </Card>
          </View>
        ) : null}

        {/* Active Bookings Summary Card with "View Orders" Button */}
        {activeBookings.length > 0 ? (
          <View className="mx-6 mb-6">
            <Card variant="default" className="p-5">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-text-primary text-xs font-black uppercase tracking-wider">
                  Active Bookings
                </Text>
                <Badge label={`${activeBookings.length} Active`} variant="brand" />
              </View>

              <View className="bg-background-secondary border border-border-primary rounded-2xl p-4">
                <Text className="text-text-primary text-sm font-extrabold" numberOfLines={1}>
                  {activeBookings[0].service_items?.name ?? 'Home Service'}
                </Text>
                <View className="flex-row items-center mt-1.5">
                  <View className="w-2 h-2 rounded-full bg-primary mr-2" />
                  <Text className="text-text-secondary text-xs font-bold capitalize" numberOfLines={1}>
                    Status: {activeBookings[0].status.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                </View>
              </View>

              <Button
                label="View Orders"
                variant="primary"
                size="md"
                onPress={() => router.push('/(customer)/bookings')}
                className="mt-4 w-full"
              />
            </Card>
          </View>
        ) : null}

        {/* Dynamic Promotional Banner Carousel */}
        {bannersData?.banners && bannersData.banners.length > 0 ? (
          <View className="mb-6 px-6">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1" contentContainerStyle={{ gap: 12 }}>
              {bannersData.banners.map((banner: any) => (
                <TouchableOpacity
                  key={banner.id}
                  onPress={() => {
                    if (banner.action_url) {
                      router.push({
                        pathname: '/(customer)/bookings/create',
                        params: { categoryId: banner.action_url }
                      });
                    }
                  }}
                  activeOpacity={0.9}
                  style={{ width: 280 }}
                  className="h-36 rounded-3xl bg-background-secondary border border-border-primary p-5 flex-row items-center justify-between overflow-hidden shadow-premium"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-text-muted text-[9px] font-black uppercase tracking-wider mb-1">
                      {banner.discount_label || 'Cleaning Services'}
                    </Text>
                    <Text className="text-text-primary text-[14px] font-black leading-5 mb-1.5" numberOfLines={2}>
                      {banner.title}
                    </Text>
                    <Text className="text-text-secondary text-[9px] font-semibold leading-3" numberOfLines={2}>
                      {banner.subtitle}
                    </Text>
                  </View>
                  <Image
                    source={require('../../assets/home_services_banner.png')}
                    style={{ width: 64, height: 64 }}
                    contentFit="contain"
                    className="rounded-full bg-white border border-border-primary"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Carousel Dot Indicators */}
            <View className="flex-row justify-center items-center mt-3">
              {bannersData.banners.map((_, i) => (
                <View 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full mx-0.5 ${i === 0 ? 'bg-text-secondary' : 'bg-border-secondary'}`} 
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Web App Parity Benefits Grid */}
        <View className="mx-6 mb-6">
          <Card variant="default" className="p-5">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-4">Volo Benefits</Text>
            <View className="flex-row justify-between">
              <TouchableOpacity 
                onPress={() => Alert.alert('VOLO Prime', 'VOLO Prime is currently active on the Web App! Mobile support is coming soon.')} 
                activeOpacity={0.8}
                className="w-[22%] items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-primary/10 justify-center items-center border border-primary/20 mb-2 shadow-sm">
                  <Ionicons name="ribbon-outline" size={20} color="rgb(var(--primary))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">Volo Prime</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => router.push('/(customer)/wallet')} 
                activeOpacity={0.8}
                className="w-[22%] items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-success/10 justify-center items-center border border-success/20 mb-2 shadow-sm">
                  <Ionicons name="wallet-outline" size={20} color="rgb(var(--success))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">My Wallet</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => Alert.alert('Refer & Earn', 'Invite your friends using the Web App to earn ₹150 rewards coins!')} 
                activeOpacity={0.8}
                className="w-[22%] items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-danger/10 justify-center items-center border border-danger/20 mb-2 shadow-sm">
                  <Ionicons name="gift-outline" size={20} color="rgb(var(--danger))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">Refer & Earn</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => router.push('/(customer)/profile')} 
                activeOpacity={0.8}
                className="w-[22%] items-center"
              >
                <View className="w-12 h-12 rounded-2xl bg-warning/10 justify-center items-center border border-warning/20 mb-2 shadow-sm">
                  <Ionicons name="map-outline" size={20} color="rgb(var(--warning))" />
                </View>
                <Text className="text-text-secondary text-[10px] font-extrabold text-center">Addresses</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Categories Section */}
        <View className="px-6 mt-2 mb-4">
          <Text className="text-text-primary text-xs font-black uppercase tracking-wider">Book a Service</Text>
        </View>

        {servicesLoading ? (
          <View className="py-12 justify-center items-center">
            <ActivityIndicator size="large" color="rgb(var(--primary))" />
            <Text className="text-text-secondary text-xs mt-2 font-medium">Loading catalog…</Text>
          </View>
        ) : categories.length === 0 ? (
          <View className="mx-6">
            <Card variant="default" className="py-12 items-center">
              <Ionicons name="alert-circle-outline" size={32} color="rgb(var(--text-muted))" />
              <Text className="text-text-secondary text-sm mt-2 font-medium">No services available</Text>
            </Card>
          </View>
        ) : (
          <View className="bg-white border-t border-b border-border-primary flex-row flex-wrap mb-8">
            {categories.map((category, index) => {
              const iconName = getCategoryIcon(category.name);
              const isThirdCol = (index + 1) % 3 === 0;
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => handleCategoryPress(category.id)}
                  activeOpacity={0.85}
                  style={{ width: '33.33%', height: 110 }}
                  className="p-1.5 bg-white justify-center items-center"
                >
                  <View className="w-full h-full rounded-2xl overflow-hidden relative border border-border-primary shadow-sm">
                    {/* Background Image / Placeholder */}
                    {category.icon_url && category.icon_url.startsWith('http') ? (
                      <Image 
                        source={{ uri: category.icon_url }} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} 
                        contentFit="cover" 
                      />
                    ) : (
                      <View className="absolute inset-0 bg-indigo-950 justify-center items-center">
                        <MaterialCommunityIcons
                          name={iconName as any}
                          size={28}
                          color="rgba(255,255,255,0.2)"
                        />
                      </View>
                    )}

                    {/* Dark overlay for text contrast */}
                    <View 
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.45)'
                      }}
                    />

                    {/* Text overlay */}
                    <View className="absolute inset-0 p-2 justify-end items-center">
                      <Text className="text-white text-[9px] font-black text-center leading-3 capitalize shadow-sm">
                        {category.name}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
