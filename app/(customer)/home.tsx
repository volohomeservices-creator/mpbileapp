import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getServices, getActiveBookings, getActiveBanners, getInitialCachedCustomerBanners, getPublicReviews } from '@/api/bookings';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useLanguage } from '@/hooks/useLanguage';
import { useCartStore } from '@/features/cart/cartStore';
import { getPublicMediaUrl } from '@/utils/media';
import { Skeleton, CustomerHomeSkeleton } from '@/components/ui/Skeleton';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { storage } from '@/utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to map category name to vector icon & pastel color dynamically
const getCategoryStyle = (name: string) => {
  const cleanName = (name || '').toLowerCase();
  if (cleanName.includes('electric')) {
    return { lib: 'Ionicons', name: 'flash-sharp', bg: '#FEF3C7', color: '#D97706' }; // Amber
  }
  if (cleanName.includes('plumb')) {
    return { lib: 'Ionicons', name: 'water-sharp', bg: '#E0F2FE', color: '#0284C7' }; // Sky Blue
  }
  if (cleanName.includes('carpenter') || cleanName.includes('wood')) {
    return { lib: 'MCI', name: 'hammer', bg: '#FFEDD5', color: '#EA580C' }; // Orange
  }
  if (cleanName.includes('ac') || cleanName.includes('air') || cleanName.includes('cool')) {
    return { lib: 'MCI', name: 'air-conditioner', bg: '#CCFBF1', color: '#0D9488' }; // Teal
  }
  if (cleanName.includes('paint')) {
    return { lib: 'MCI', name: 'format-paint', bg: '#FCE7F3', color: '#DB2777' }; // Pink
  }
  if (cleanName.includes('clean')) {
    return { lib: 'MCI', name: 'broom', bg: '#EDE9FE', color: '#7C3AED' }; // Purple
  }
  if (cleanName.includes('appliance') || cleanName.includes('wash') || cleanName.includes('repair')) {
    return { lib: 'MCI', name: 'washing-machine', bg: '#E0E7FF', color: '#4F46E5' }; // Indigo
  }
  if (cleanName.includes('ro') || cleanName.includes('water')) {
    return { lib: 'MCI', name: 'filter', bg: '#CFFAFE', color: '#0891B2' }; // Cyan
  }
  return { lib: 'Ionicons', name: 'grid-sharp', bg: '#F3F4F6', color: '#4B5563' };
};

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  // User Avatar & Initials derivation
  const rawAvatarPath = (user as any)?.avatar_url;
  const avatarUrl = rawAvatarPath ? getPublicMediaUrl(rawAvatarPath, 'profile-images') : null;
  const userInitial = user?.full_name
    ? user.full_name.trim().charAt(0).toUpperCase()
    : ((user as any)?.name ? (user as any).name.trim().charAt(0).toUpperCase() : '');

  const {
    items: cartItems,
    addItem,
    removeItem,
    getItemQuantity,
    getTotalCount,
    getTotalPrice,
  } = useCartStore();
  const totalCartCount = getTotalCount();

  // Location State
  const [locationName, setLocationName] = useState('Hyderabad');
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 1. Dynamic Real Services Data from Database API (/api/customer/services)
  const {
    data: servicesData,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ['customer-services'],
    queryFn: getServices,
  });

  // 2. Dynamic Real Banners Data from Database API (/api/customer/banners)
  const {
    data: bannersData,
    isLoading: bannersLoading,
  } = useQuery({
    queryKey: ['customer-active-banners'],
    queryFn: getActiveBanners,
    initialData: getInitialCachedCustomerBanners,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // 3. Dynamic Real Active Bookings
  const {
    data: activeBookingsData,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['customer-active-bookings'],
    queryFn: getActiveBookings,
    refetchInterval: 8_000,
  });

  // 4. Dynamic Verified Public Reviews & Platform Reputation
  const { data: publicReviewsData } = useQuery({
    queryKey: ['customer-public-reviews'],
    queryFn: () => getPublicReviews(5),
    staleTime: 5 * 60 * 1000,
  });

  // Dynamic Location reverse-geocoding
  useEffect(() => {
    (async () => {
      try {
        const savedCity = await storage.getItem('volo_customer_service_city');
        if (savedCity) {
          setLocationName(savedCity);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('Hyderabad');
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

        if (Platform.OS === 'web') {
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${location.coords.latitude}&lon=${location.coords.longitude}&format=json`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data?.address) {
                const city = data.address.city || data.address.town || data.address.suburb || 'Hyderabad';
                setLocationName(city);
              }
            }
          } catch {
            setLocationName('Hyderabad');
          }
        } else {
          const reverse = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
          if (reverse && reverse.length > 0) {
            const first = reverse[0];
            const city = first.city || first.subregion || first.region || 'Hyderabad';
            setLocationName(city);
          }
        }
      } catch (e: any) {
        const errMsg = e?.message || (typeof e === 'object' && e?.code ? `Code ${e.code}` : null);
        console.warn('Location resolution fallback to default:', errMsg || 'Permission not granted or unavailable');
        setLocationName('Hyderabad');
      }
    })();
  }, []);

  const handleSelectCity = async (city: string) => {
    setLocationName(city);
    await storage.setItem('volo_customer_service_city', city);
  };

  useRefreshOnFocus(refetchBookings);
  useRefreshOnFocus(refetchServices);

  const categories = servicesData?.categories ?? [];
  const allItems = categories.flatMap((c: any) => c.items ?? []);
  const banners = bannersData?.banners ?? [];

  const isHeroPlacement = (p?: string) => 
    p === 'HERO' || p === 'CUSTOMER_HERO' || p === 'ALL_HERO' || p === 'UNIVERSAL_HERO';
  const isPromoPlacement = (p?: string) => 
    p === 'PROMO' || p === 'CUSTOMER_PROMO' || p === 'ALL_PROMO' || p === 'UNIVERSAL_PROMO';

  const heroBanner = 
    banners.find((b: any) => isHeroPlacement(b?.placement)) || 
    banners.find((b: any) => !isPromoPlacement(b?.placement) && b?.placement !== 'WEB' && b?.placement !== 'CUSTOMER_WEB') || 
    banners[0] || 
    null;

  const promoBanners = banners.filter((b: any) => 
    (isPromoPlacement(b?.placement) || b.id?.startsWith('promo-') || b?.placement === 'ALL' || b?.placement === 'ALL_MOBILE') && 
    b.id !== heroBanner?.id
  );

  // Active bookings list
  const activeBookings = activeBookingsData?.bookings || [];
  const primaryActiveBooking = activeBookings[0] || null;

  const publicReviews = publicReviewsData?.reviews || [];
  const platformReputation = publicReviewsData?.reputation;

  const handleCategoryPress = (categoryId?: string) => {
    router.push({
      pathname: '/(customer)/bookings/create',
      params: { categoryId: categoryId || 'all' },
    });
  };

  const handleBookServiceDirect = (service: any) => {
    addItem({
      id: service.id,
      name: service.name,
      description: service.description,
      base_price: Number(service.base_price),
      estimated_mins: service.estimated_mins,
      category_id: service.category_id,
    });
    router.push({
      pathname: '/(customer)/bookings/create',
      params: { serviceId: service.id, checkout: 'true' },
    } as any);
  };

  // Filter categories by search input
  const filteredCategories = categories.filter((cat: any) =>
    cat.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <SafeAreaView style={{ backgroundColor: '#FFFFFF' }} className="flex-1" edges={['top']}>
      {/* ========================================================================= */}
      {/* CRISP WHITE TOP NAVIGATION BAR */}
      {/* ========================================================================= */}
      <View className="px-4 py-2 bg-white border-b border-slate-100 flex-row items-center justify-between z-30">
        {/* Left: Brand Logo Image (assets/volo logo 2.png) */}
        <TouchableOpacity
          onPress={() => router.push('/(customer)/home')}
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
            {locationName}
          </Text>
          <Ionicons name="chevron-down" size={11} color="#64748B" />
        </TouchableOpacity>

        {/* Right: Actions (Notification & Profile Avatar) */}
        <View className="flex-row items-center gap-2">
          {/* Notification Button */}
          <TouchableOpacity
            onPress={() => router.push('/(customer)/notifications')}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200/80 items-center justify-center relative active:bg-slate-200"
          >
            <Ionicons name="notifications-outline" size={18} color="#1E293B" />
            <View className="w-2.5 h-2.5 rounded-full bg-[#EF4444] absolute top-1.5 right-1.5 border-2 border-white" />
          </TouchableOpacity>

          {/* Profile Avatar Button */}
          <TouchableOpacity
            onPress={() => router.push('/(customer)/profile')}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-full overflow-hidden bg-purple-600 border border-purple-200 items-center justify-center active:opacity-90 shadow-sm"
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : userInitial ? (
              <Text className="text-white text-xs font-black">
                {userInitial}
              </Text>
            ) : (
              <Ionicons name="person" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {servicesLoading && !servicesData ? (
        <CustomerHomeSkeleton />
      ) : (
        <ScrollView
          className="flex-1 bg-[#F8F7FC]"
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
        {/* ========================================================================= */}
        {/* HERO DARK SECTION */}
        {/* ========================================================================= */}
        <View style={{ backgroundColor: '#0B0224' }} className="w-full relative overflow-hidden">
          {/* Subtle Ambient Background Gradient Glow */}
          <LinearGradient
            colors={['#0B0224', '#150638', '#1D074B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Hero Content Area */}
          <View className="px-5 pt-4 pb-10 flex-row relative z-10">
            {/* Left Column: Text, Value Props, and CTA */}
            <View className="flex-1 pr-1 z-20 justify-center">
              {/* Pill Tag: 🏠 Home Services, Simplified */}
              <View className="bg-white/10 border border-white/20 rounded-full px-3 py-1 flex-row items-center self-start mb-2.5">
                <Text className="mr-1 text-xs">🏠</Text>
                <Text className="text-white/95 text-[11px] font-bold">
                  {heroBanner?.discount_label || 'Home Services, Simplified'}
                </Text>
              </View>

              {/* Punchy Hero Headline */}
              {heroBanner?.title ? (
                <Text className="text-white text-[27px] font-black leading-[1.14] tracking-tight mb-3">
                  {heroBanner.title}
                </Text>
              ) : (
                <Text className="text-white text-[27px] font-black leading-[1.14] tracking-tight mb-3">
                  Trusted services,
                  {'\n'}
                  <Text className="text-[#C084FC]">right at your</Text>
                  {'\n'}
                  doorstep
                </Text>
              )}

              {/* 3 Value Propositions */}
              <View className="flex-row flex-wrap gap-x-3 gap-y-1.5 mb-4 max-w-[260px]">
                {/* 1. Verified Professionals */}
                <View className="flex-row items-center gap-1">
                  <Ionicons name="shield-checkmark-outline" size={12} color="#FFFFFF" />
                  <Text className="text-white/90 text-[10px] font-medium">
                    Verified Professionals
                  </Text>
                </View>

                {/* 2. Transparent Pricing */}
                <View className="flex-row items-center gap-1">
                  <Ionicons name="pricetag-outline" size={12} color="#FFFFFF" />
                  <Text className="text-white/90 text-[10px] font-medium">
                    Transparent Pricing
                  </Text>
                </View>

                {/* 3. On-time Service */}
                <View className="flex-row items-center gap-1">
                  <Ionicons name="flash-outline" size={12} color="#FFFFFF" />
                  <Text className="text-white/90 text-[10px] font-medium">
                    On-time Service
                  </Text>
                </View>
              </View>

              {/* Glowing Hero CTA Button */}
              <TouchableOpacity
                onPress={() => handleCategoryPress(heroBanner?.action_url || undefined)}
                activeOpacity={0.88}
                className="self-start active:scale-95 shadow-xl"
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED', '#5B21B6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 999,
                    paddingLeft: 18,
                    paddingRight: 8,
                    paddingVertical: 9,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.25)',
                  }}
                >
                  <Text className="text-white text-xs font-black mr-2">
                    {heroBanner?.subtitle || 'Book a service'}
                  </Text>
                  <View className="w-7 h-7 rounded-full bg-white items-center justify-center shadow-sm">
                    <Ionicons name="arrow-forward" size={14} color="#6D28D9" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Hero Banner Background Image: Full Card Display with responsive gradient scrim */}
            {heroBanner?.image_url ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                }}
              >
                <Image
                  source={{ uri: getPublicMediaUrl(heroBanner.image_url, 'services') || heroBanner.image_url }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  contentFit="cover"
                  contentPosition={(heroBanner.image_position as any) || 'center'}
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <LinearGradient
                  colors={['rgba(11, 2, 36, 0.94)', 'rgba(11, 2, 36, 0.65)', 'rgba(11, 2, 36, 0.15)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : !bannersLoading ? (
              /* Default fallback technician portrait only when genuinely finished loading with no hero banner */
              <View
                style={{
                  position: 'absolute',
                  right: -10,
                  bottom: 0,
                  top: 0,
                  width: '52%',
                  justifyContent: 'flex-end',
                  pointerEvents: 'none',
                }}
              >
                <Image
                  source={require('../../assets/hero_technician.jpg')}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderBottomRightRadius: 28,
                  }}
                  contentFit="cover"
                  contentPosition="top right"
                  cachePolicy="memory-disk"
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* ========================================================================= */}
        {/* CURVED WHITE CONTENT SHEET (Sliding Up Smoothly) */}
        {/* ========================================================================= */}
        <View className="bg-[#F8F7FC] rounded-t-[36px] -mt-6 pt-5 shadow-2xl relative z-30">
          {/* Search Bar Section */}
          <View className="px-5 mb-5">
            <View className="flex-row items-center bg-white border border-[#E6E0F5] rounded-2xl px-4 h-13 shadow-sm">
              <Ionicons name="search-outline" size={19} color="#8E84B0" style={{ marginRight: 10 }} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                className="flex-1 text-[#1E1535] text-xs font-bold h-full"
                placeholder="Search for a service..."
                placeholderTextColor="#8E84B0"
              />
              <Feather name="mic" size={17} color="#8E84B0" />
            </View>
          </View>

          {/* ACTIVE BOOKING LIVE TRACKING BANNER (If customer has placed order) */}
          {primaryActiveBooking && (
            <View className="px-5 mb-5">
              <TouchableOpacity
                onPress={() => router.push(`/(customer)/bookings/${primaryActiveBooking.id}` as any)}
                activeOpacity={0.88}
                className="bg-white rounded-3xl p-4 border-2 border-purple-300 shadow-premium flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="w-11 h-11 rounded-2xl bg-purple-100 items-center justify-center mr-3 border border-purple-200">
                    <Ionicons name="car" size={20} color="#3C01A7" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <View className="w-2 h-2 rounded-full bg-emerald-500" />
                      <Text className="text-purple-900 text-xs font-black uppercase tracking-wider">
                        Live Service Status
                      </Text>
                    </View>
                    <Text className="text-slate-900 text-xs font-extrabold mt-0.5" numberOfLines={1}>
                      {primaryActiveBooking.service_items?.name || 'Service Booking'}
                    </Text>
                    <Text className="text-slate-500 text-[10px] font-medium">
                      Status: {primaryActiveBooking.status?.replace(/_/g, ' ')} • Tap to track live
                    </Text>
                  </View>
                </View>

                <View className="w-8 h-8 rounded-full bg-purple-50 items-center justify-center border border-purple-200">
                  <Ionicons name="chevron-forward" size={16} color="#3C01A7" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Service Categories Grid */}
          <View className="px-5 mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#1E1535] text-sm font-black tracking-wide">
                Book a Service
              </Text>
              <TouchableOpacity onPress={() => handleCategoryPress()}>
                <Text className="text-[#3C01A7] text-xs font-extrabold">View All</Text>
              </TouchableOpacity>
            </View>

            {servicesLoading ? (
              <View className="bg-white border border-[#E6E0F5] rounded-3xl p-8 items-center justify-center shadow-xs">
                <ActivityIndicator size="small" color="#3C01A7" />
                <Text className="text-[#8E84B0] text-xs font-semibold mt-2">Loading live service catalog...</Text>
              </View>
            ) : filteredCategories.length === 0 ? (
              <View className="bg-white border border-[#E6E0F5] rounded-3xl p-6 items-center shadow-xs">
                <Ionicons name="alert-circle-outline" size={24} color="#8E84B0" />
                <Text className="text-[#584F75] text-xs font-bold mt-1">No services found.</Text>
              </View>
            ) : (
              <View className="bg-white border border-[#E6E0F5] rounded-3xl p-4 shadow-sm flex-row flex-wrap gap-y-4">
                {filteredCategories.map((cat: any) => {
                  const styleInfo = getCategoryStyle(cat.name);
                  const catImageUrl = getPublicMediaUrl(cat.icon_url, 'service-images');
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => handleCategoryPress(cat.id)}
                      activeOpacity={0.75}
                      style={{ width: '25%' }}
                      className="items-center px-1"
                    >
                      <View
                        style={{ backgroundColor: styleInfo.bg }}
                        className="w-13 h-13 rounded-2xl justify-center items-center mb-1.5 shadow-xs overflow-hidden"
                      >
                        {catImageUrl ? (
                          <Image
                            source={{ uri: catImageUrl }}
                            style={{ width: 34, height: 34 }}
                            contentFit="contain"
                          />
                        ) : styleInfo.lib === 'MCI' ? (
                          <MaterialCommunityIcons name={styleInfo.name as any} size={22} color={styleInfo.color} />
                        ) : (
                          <Ionicons name={styleInfo.name as any} size={22} color={styleInfo.color} />
                        )}
                      </View>
                      <Text
                        className="text-[#1E1535] text-[10px] font-extrabold text-center leading-3 capitalize"
                        numberOfLines={2}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Popular Services Section */}
          {allItems.length > 0 && (
            <View className="px-5 mb-6">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[#1E1535] text-sm font-black tracking-wide">Popular Services</Text>
                <TouchableOpacity onPress={() => handleCategoryPress()}>
                  <Text className="text-[#3C01A7] text-xs font-extrabold">View All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {allItems.slice(0, 8).map((service: any) => {
                  const qty = getItemQuantity(service.id);
                  const serviceImageUrl = getPublicMediaUrl(service.icon_url || service.image_url, 'service-images');
                  return (
                    <TouchableOpacity
                      key={service.id}
                      activeOpacity={0.9}
                      onPress={() => handleBookServiceDirect(service)}
                      className="bg-white border border-[#E6E0F5] rounded-3xl w-60 shadow-xs overflow-hidden justify-between"
                    >
                      {/* Full-width Service Cover Image */}
                      <View className="w-full h-32 bg-[#F0EBFB] relative overflow-hidden">
                        {serviceImageUrl ? (
                          <Image
                            source={{ uri: serviceImageUrl }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center bg-purple-50">
                            <Ionicons name="sparkles" size={28} color="#7C3AED" />
                          </View>
                        )}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.3)']}
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36 }}
                        />
                        <View className="absolute top-2.5 right-2.5 bg-white/95 px-2.5 py-1 rounded-full shadow-sm border border-purple-100/60">
                          <Text className="text-[#3C01A7] text-[9px] font-black uppercase tracking-wider">POPULAR</Text>
                        </View>
                      </View>

                      {/* Service Info & Content */}
                      <View className="p-3.5 flex-1 justify-between">
                        <View>
                          <Text className="text-[#1E1535] text-sm font-black mb-1 leading-snug" numberOfLines={2}>
                            {service.name}
                          </Text>
                          {service.estimated_mins && (
                            <Text className="text-[#8E84B0] text-[10px] font-semibold mb-2">
                              ⏱ {service.estimated_mins} mins
                            </Text>
                          )}
                        </View>

                      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-[#F0EBFB]">
                        <Text className="text-[#1E1535] text-sm font-black">₹{service.base_price}</Text>

                        <View className="flex-row items-center gap-1.5">
                          {/* Instant Book Now button */}
                          <TouchableOpacity
                            onPress={() => handleBookServiceDirect(service)}
                            activeOpacity={0.85}
                            style={{ backgroundColor: '#3C01A7' }}
                            className="px-2.5 py-1.5 rounded-xl shadow-xs"
                          >
                            <Text className="text-white text-[10px] font-black">Book Now</Text>
                          </TouchableOpacity>

                          {/* Add to Cart Stepper / Button */}
                          {qty > 0 ? (
                            <View className="flex-row items-center bg-[#F0EBFB] rounded-xl px-1.5 py-1 border border-[#3C01A7]/30">
                              <TouchableOpacity
                                onPress={() => removeItem(service.id)}
                                activeOpacity={0.8}
                                className="w-4 h-4 rounded-md bg-white items-center justify-center shadow-xs"
                              >
                                <Ionicons name="remove" size={10} color="#3C01A7" />
                              </TouchableOpacity>
                              <Text className="text-[#3C01A7] text-[10px] font-black px-1.5">{qty}</Text>
                              <TouchableOpacity
                                onPress={() => addItem({
                                  id: service.id,
                                  name: service.name,
                                  description: service.description,
                                  base_price: Number(service.base_price),
                                  estimated_mins: service.estimated_mins,
                                  category_id: service.category_id,
                                })}
                                activeOpacity={0.8}
                                className="w-4 h-4 rounded-md bg-[#3C01A7] items-center justify-center shadow-xs"
                              >
                                <Ionicons name="add" size={10} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => addItem({
                                id: service.id,
                                name: service.name,
                                description: service.description,
                                base_price: Number(service.base_price),
                                estimated_mins: service.estimated_mins,
                                category_id: service.category_id,
                              })}
                              activeOpacity={0.8}
                              className="flex-row items-center bg-[#F0EBFB] border border-[#3C01A7] px-2 py-1.5 rounded-xl"
                            >
                              <Ionicons name="cart-outline" size={11} color="#3C01A7" style={{ marginRight: 2 }} />
                              <Text className="text-[#3C01A7] text-[9px] font-black">+ Cart</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Promotional Banners */}
          {promoBanners.length > 0 && (
            <View className="px-5 mb-6">
              {promoBanners.map((banner: any) => (
                <TouchableOpacity
                  key={banner.id}
                  activeOpacity={0.9}
                  onPress={() => handleCategoryPress(banner.action_url)}
                  style={{ 
                    backgroundColor: banner.background_color || '#13073A',
                    borderRadius: 24,
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 125,
                    padding: 18,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(88, 28, 135, 0.5)',
                    justifyContent: 'center',
                  }}
                >
                  {banner.image_url && (
                    <>
                      <Image
                        source={{ uri: banner.image_url }}
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
                        contentPosition={(banner.image_position as any) || 'center'}
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                      <LinearGradient
                        colors={banner.title ? ['rgba(19, 7, 58, 0.92)', 'rgba(19, 7, 58, 0.55)', 'rgba(19, 7, 58, 0.15)'] : ['transparent', 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </>
                  )}
                  {banner.title ? (
                    <View style={{ position: 'relative', zIndex: 10, maxWidth: '85%' }}>
                      <Text className="text-[#FBBF24] text-[9px] font-black uppercase tracking-widest mb-0.5">
                        {banner.discount_label || 'SPECIAL PROMO'}
                      </Text>
                      <Text className="text-white text-base font-black leading-tight">
                        {banner.title}
                      </Text>
                      {banner.subtitle ? (
                        <Text className="text-white/80 text-[10px] font-semibold mt-1">
                          {banner.subtitle}
                        </Text>
                      ) : null}
                      {banner.button_text ? (
                        <View className="bg-white/20 border border-white/30 px-3 py-1 rounded-full self-start mt-2.5 flex-row items-center gap-1 shadow-xs">
                          <Text className="text-white text-[10px] font-black">{banner.button_text}</Text>
                          <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* "How It Works?" Workflow Steps */}
          <View className="px-5 mb-8">
            <Text className="text-[#1E1535] text-sm font-black mb-3">How It Works?</Text>

            <View className="bg-white border border-[#E6E0F5] rounded-3xl p-5 shadow-sm flex-row items-center justify-between">
              {/* Step 1 */}
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-[#F0EBFB] border border-[#D8CEF6] justify-center items-center mb-1.5">
                  <Ionicons name="phone-portrait-sharp" size={20} color="#3C01A7" />
                </View>
                <Text className="text-[#1E1535] text-[9px] font-black text-center leading-3">
                  1. Choose Service
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#8E84B0" />

              {/* Step 2 */}
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-[#F0EBFB] border border-[#D8CEF6] justify-center items-center mb-1.5">
                  <Ionicons name="calendar-sharp" size={20} color="#3C01A7" />
                </View>
                <Text className="text-[#1E1535] text-[9px] font-black text-center leading-3">
                  2. Book Technician
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#8E84B0" />

              {/* Step 3 */}
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-[#F0EBFB] border border-[#D8CEF6] justify-center items-center mb-1.5">
                  <Ionicons name="home-sharp" size={20} color="#3C01A7" />
                </View>
                <Text className="text-[#1E1535] text-[9px] font-black text-center leading-3">
                  3. Service at Doorstep
                </Text>
              </View>
            </View>
          </View>

          {/* Verified Customer Reviews & Reputation */}
          <View className="px-5 mb-8">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text className="text-[#1E1535] text-sm font-black tracking-wide">
                  Customer Reviews
                </Text>
              </View>
              <View className="flex-row items-center bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Ionicons name="shield-checkmark" size={11} color="#D97706" style={{ marginRight: 3 }} />
                <Text className="text-[#D97706] text-[10px] font-black">
                  {platformReputation?.average_rating ? `${platformReputation.average_rating.toFixed(1)} ★ Verified` : '★ Verified'}
                </Text>
              </View>
            </View>

            {publicReviews.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {publicReviews.map((rev: any) => (
                  <View
                    key={rev.id}
                    style={{ width: 260 }}
                    className="bg-white border border-[#E6E0F5] rounded-3xl p-4 shadow-sm justify-between"
                  >
                    <View className="space-y-2">
                      <View className="flex-row justify-between items-center mb-1">
                        <View className="flex-row items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons
                              key={s}
                              name="star"
                              size={12}
                              color={s <= (rev.rating || 5) ? '#F59E0B' : '#E2E8F0'}
                            />
                          ))}
                        </View>
                        <Text className="text-[#3C01A7] text-[9px] font-black uppercase bg-[#F0EBFB] px-2 py-0.5 rounded-md">
                          {rev.service_name || 'Service'}
                        </Text>
                      </View>

                      <Text className="text-[#1E1535] text-xs font-semibold leading-relaxed italic" numberOfLines={3}>
                        "{rev.text || rev.comment || 'Great service experience with Volo.'}"
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-2 pt-3 mt-3 border-t border-[#F4F3FA]">
                      <View className="w-6 h-6 rounded-full bg-[#3C01A7] items-center justify-center">
                        <Text className="text-white text-[9px] font-black">
                          {rev.name?.charAt(0).toUpperCase() || 'C'}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-[#1E1535] text-[11px] font-black">{rev.name}</Text>
                        <Text className="text-[#8E84B0] text-[9px] font-medium">Verified Customer</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </ScrollView>
      )}

      {/* Floating Mini Cart Bar */}
      {totalCartCount > 0 && (
        <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 90 : 80, left: 16, right: 16, zIndex: 900 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(customer)/cart/index' as any)}
            style={{ backgroundColor: '#1E1535' }}
            className="rounded-2xl p-3.5 shadow-2xl border border-white/10 flex-row justify-between items-center"
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-[#3C01A7] items-center justify-center mr-2.5">
                <Ionicons name="cart" size={16} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-white text-xs font-black">
                  {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} in cart
                </Text>
                <Text className="text-white/70 text-[10px] font-semibold">
                  Total: ₹{getTotalPrice()}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center bg-[#3C01A7] px-3.5 py-1.5 rounded-xl">
              <Text className="text-white text-xs font-black mr-1">{t('bookings.viewCart')}</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}
      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        currentCity={locationName}
        onSelectCity={handleSelectCity}
        title="Select Service Location"
        subtitle="Choose your city to discover available services & partners"
      />
    </SafeAreaView>
  );
}
