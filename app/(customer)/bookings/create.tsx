import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, TextInput, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getServices, createBooking } from '@/api/bookings';
import { CreateBookingSchema } from '@volo/shared-types';
import { getAddresses } from '@/api/profile';
import { useLanguage } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// Platform-resilient showAlert helper supporting callbacks
const showAlert = (
  title: string,
  message: string,
  buttons?: Array<{ text: string; onPress?: () => void }>
) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
    if (buttons && buttons.length > 0) {
      const primaryButton = buttons[buttons.length - 1];
      if (primaryButton.onPress) primaryButton.onPress();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

export default function CreateBookingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { t } = useLanguage();

  // UI Flow Step State
  const [step, setStep] = useState<'catalog' | 'checkout'>('catalog');

  // Booking details state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<'ONLINE' | 'COD' | 'WALLET'>('COD');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [bookingTime, setBookingTime] = useState<'immediate' | 'later'>('immediate');
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Fetch Services catalog
  const { data, isLoading } = useQuery({
    queryKey: ['customer-services'],
    queryFn: getServices,
  });

  // Fetch Saved Addresses
  const { data: addressesData } = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: getAddresses,
  });
  const savedAddresses = addressesData?.addresses ?? [];

  // Get current category & items
  const categories = data?.categories ?? [];
  const currentCategory = categories.find((c) => c.id === categoryId);
  const services = currentCategory?.items ?? [];

  // Get GPS location on mount
  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Location permission is required to find workers nearby.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      
      let formattedAddress = '';

      if (Platform.OS === 'web') {
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
            formattedAddress = [
              addr.suburb || addr.neighbourhood || addr.village || addr.road,
              addr.city || addr.town || addr.county
            ]
              .filter(Boolean)
              .join(', ');
          }
        }
      } else {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (geocode && geocode.length > 0) {
          const item = geocode[0];
          formattedAddress = [
            item.name,
            item.street,
            item.district,
            item.city,
            item.postalCode
          ].filter(Boolean).join(', ');
        }
      }

      setAddress(formattedAddress || 'Pinned Location');
    } catch (err) {
      console.warn('Failed to fetch location automatically:', err);
    } finally {
      setLocating(false);
    }
  };

  // Mutation to place booking
  const bookingMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (res) => {
      if (res.success) {
        showAlert('Booking Placed', 'Your booking request has been sent successfully.', [
          {
            text: 'View Booking',
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['customer-active-bookings'] });
              router.replace(`/(customer)/bookings/${res.bookingId}`);
            },
          },
        ]);
      } else {
        showAlert('Booking Error', res.message ?? 'Failed to place booking.');
      }
    },
    onError: (err: any) => {
      showAlert('Error', err?.response?.data?.error ?? 'Unable to create booking. Please try again.');
    },
  });

  const handleBook = () => {
    const payload = {
      service_item_id: selectedService,
      address: address.trim(),
      latitude: coords?.lat,
      longitude: coords?.lng,
      payment_mode: paymentMode,
      notes: notes.trim() || undefined,
    };

    const validation = CreateBookingSchema.safeParse(payload);
    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || 'Validation error';
      showAlert('Validation Error', errorMsg);
      return;
    }

    bookingMutation.mutate(validation.data);
  };

  const selectedItemData = services.find((s) => s.id === selectedService);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="rgb(var(--primary))" />
        <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  // STEP 1: SERVICE CATALOG / DETAILS PAGE
  if (step === 'catalog') {
    return (
      <View className="flex-1 bg-white">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header Image Slider */}
          <View className="h-56 bg-background-secondary relative">
            <Image
              source={require('../../../assets/home_services_banner.png')}
              style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
            />
            {/* Overlay Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="absolute left-6 top-12 w-9 h-9 rounded-full bg-white justify-center items-center shadow-premium border border-border-primary"
            >
              <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
            </TouchableOpacity>
          </View>

          {/* Service Info Block */}
          <View className="px-6 py-5 border-b border-border-primary bg-white">
            <View className="flex-row justify-between items-center mb-1.5">
              <Text className="text-text-primary text-xl font-extrabold">{currentCategory?.name || t('bookings.bookService')}</Text>
              <Badge label={t('bookings.vSafe')} variant="brand" />
            </View>

            <View className="flex-row items-center gap-3 mb-4">
              <View className="flex-row items-center">
                <Ionicons name="star" size={14} color="rgb(var(--warning))" />
                <Text className="text-text-primary text-xs font-bold ml-1">
                  {(currentCategory as any)?.average_rating ?? '4.8'}
                </Text>
                <Text className="text-text-muted text-xs font-medium ml-1">
                  ({(currentCategory as any)?.total_reviews ?? '5'} reviews)
                </Text>
              </View>
              <View className="w-1 h-1 rounded-full bg-border-secondary" />
              <Text className="text-text-secondary text-xs font-medium">
                {(currentCategory as any)?.total_bookings ?? '12'} bookings last week
              </Text>
            </View>

            {/* Highly trained badge */}
            <View className="border border-border-secondary rounded-2xl p-4 flex-row justify-between items-center bg-background-secondary">
              <View className="flex-row items-center">
                <Ionicons name="trophy-outline" size={16} color="rgb(var(--warning))" className="mr-2" />
                <Text className="text-text-secondary text-xs font-bold">{t('bookings.highlyTrained')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-secondary))" />
            </View>
          </View>

          {/* Offers sliding horizontal list */}
          <View className="py-4 border-b border-border-primary bg-white">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
              <View className="bg-success/5 border border-success/15 p-3 rounded-2xl flex-row items-center min-w-[210px]">
                <Ionicons name="pricetag-outline" size={16} color="rgb(var(--success))" className="mr-2" />
                <View>
                  <Text className="text-text-primary text-[10px] font-extrabold">{t('bookings.cashBack')}</Text>
                  <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">{t('bookings.cashBackSub')}</Text>
                </View>
              </View>

              <View className="bg-primary/5 border border-primary/15 p-3 rounded-2xl flex-row items-center min-w-[210px]">
                <Ionicons name="ribbon-outline" size={16} color="rgb(var(--primary))" className="mr-2" />
                <View>
                  <Text className="text-text-primary text-[10px] font-extrabold">{t('bookings.flatOff')}</Text>
                  <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">{t('bookings.flatOffSub')}</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Services list */}
          <View className="px-6 py-5 bg-background-secondary mb-20">
            <Text className="text-text-secondary text-xs font-black uppercase tracking-wider mb-4">{t('bookings.chooseOptions')}</Text>
            {services.map((item) => {
              const isSelected = selectedService === item.id;
              return (
                <View key={item.id} className="mb-4">
                  <Card variant="default" className="p-5">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-4">
                        <Text className="text-text-primary text-base font-extrabold mb-1">{item.name}</Text>
                        {item.description ? (
                          <Text className="text-text-secondary text-xs leading-4 mb-3" numberOfLines={3}>{item.description}</Text>
                        ) : null}
                        <View className="flex-row items-center bg-background-secondary self-start px-2.5 py-1 rounded-lg border border-border-primary">
                          <Ionicons name="time-outline" size={12} color="rgb(var(--text-secondary))" />
                          <Text className="text-text-secondary text-[10px] font-bold ml-1">
                            {item.estimated_mins} mins
                          </Text>
                        </View>
                      </View>

                      {/* Add Button / Counter */}
                      <View className="items-end">
                        <Text className="text-text-primary text-base font-extrabold mb-4">₹{item.base_price}</Text>
                        {isSelected ? (
                          <View className="flex-row items-center border border-primary/20 bg-primary/10 rounded-xl px-2 py-1">
                            <TouchableOpacity onPress={() => setSelectedService(null)} activeOpacity={0.8} className="p-1">
                              <Ionicons name="remove" size={14} color="rgb(var(--primary))" />
                            </TouchableOpacity>
                            <Text className="text-primary text-xs font-bold px-3">1</Text>
                            <TouchableOpacity onPress={() => {}} activeOpacity={0.8} className="p-1 opacity-45">
                              <Ionicons name="add" size={14} color="rgb(var(--primary))" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => setSelectedService(item.id)}
                            activeOpacity={0.8}
                            className="border border-primary/25 rounded-xl px-5 py-1.5 active:bg-primary/10"
                          >
                            <Text className="text-primary text-xs font-bold">ADD</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </Card>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Floating bottom checkout bar */}
        {selectedItemData ? (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border-primary px-6 py-4 flex-row justify-between items-center shadow-premium">
            <View>
              <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{t('bookings.totalPrice')}</Text>
              <Text className="text-text-primary text-xl font-extrabold">₹{selectedItemData.base_price}</Text>
            </View>
            <Button
              label={t('bookings.viewCart')}
              variant="primary"
              size="md"
              onPress={() => setStep('checkout')}
              className="px-8"
            />
          </View>
        ) : null}
      </View>
    );
  }

  // STEP 2: CHECKOUT SUMMARY SCREEN
  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white shadow-sm">
        <TouchableOpacity
          onPress={() => setStep('catalog')}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold flex-1">{t('bookings.summary')}</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Address Card */}
        <View className="mb-4">
          <Card variant="default" className="p-5">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Ionicons name="home-outline" size={16} color="rgb(var(--primary))" className="mr-2" />
                <Text className="text-text-primary text-sm font-extrabold">{t('bookings.serviceLocation')}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditingAddress(!isEditingAddress)} activeOpacity={0.8}>
                <Text className="text-primary text-xs font-bold">
                  {isEditingAddress ? t('bookings.done') : t('bookings.edit')}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingAddress ? (
              <TextInput
                value={address}
                onChangeText={setAddress}
                className="bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-xs h-16"
                multiline
              />
            ) : (
              <Text className="text-text-secondary text-xs font-semibold leading-4">
                {address || t('bookings.awaitingGps')}
              </Text>
            )}

            {/* GPS Status */}
            {coords ? (
              <Text className="text-text-muted text-[9px] font-mono mt-2">
                GPS Lock: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            ) : (
              <View className="flex-row items-center mt-2">
                <ActivityIndicator size="small" color="rgb(var(--warning))" className="mr-1.5" />
                <Text className="text-warning text-[10px] font-bold">{t('bookings.acquiringCoords')}</Text>
              </View>
            )}

            {/* Saved Addresses chips */}
            {savedAddresses.length > 0 && (
              <View className="mt-4">
                <Text className="text-text-muted text-[9px] font-black uppercase tracking-wider mb-2">{t('bookings.savedAddresses')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                  {savedAddresses.map((addr: any) => {
                    const isSelected = address.trim() === addr.address.trim();
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        onPress={() => {
                          setAddress(addr.address);
                          setCoords({ lat: Number(addr.latitude), lng: Number(addr.longitude) });
                        }}
                        activeOpacity={0.9}
                        className={`mr-2.5 px-3 py-1.5 rounded-xl border flex-row items-center active:scale-95 ${
                          isSelected 
                            ? 'bg-primary/10 border-primary/20' 
                            : 'bg-background-secondary border-border-secondary'
                        }`}
                      >
                        <Ionicons 
                          name={addr.label.toLowerCase() === 'home' ? 'home-outline' : addr.label.toLowerCase() === 'work' || addr.label.toLowerCase() === 'office' ? 'business-outline' : 'location-outline'} 
                          size={12} 
                          color={isSelected ? 'rgb(var(--primary))' : 'rgb(var(--text-secondary))'} 
                          className="mr-1.5"
                        />
                        <Text className={`text-[10px] font-bold ${isSelected ? 'text-primary' : 'text-text-secondary'}`}>
                          {addr.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Current GPS button */}
            <TouchableOpacity
              onPress={getLocation}
              disabled={locating}
              activeOpacity={0.8}
              className="mt-3.5 py-2.5 rounded-xl bg-background-secondary border border-border-primary flex-row items-center justify-center active:bg-slate-100"
            >
              {locating ? (
                <ActivityIndicator size="small" color="rgb(var(--primary))" className="mr-2" />
              ) : (
                <Ionicons name="location-outline" size={14} color="rgb(var(--primary))" className="mr-1.5" />
              )}
              <Text className="text-primary text-[10px] font-bold">
                {locating ? t('bookings.detectingGps') : t('bookings.useCurrentGps')}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Slot Options */}
        <View className="mb-4">
          <Card variant="default" className="p-5">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">{t('bookings.selectBookingOption')}</Text>
            
            <TouchableOpacity
              onPress={() => setBookingTime('immediate')}
              activeOpacity={0.85}
              className={`border rounded-2xl p-4 mb-2 flex-row justify-between items-center ${
                bookingTime === 'immediate' ? 'border-primary bg-primary/5' : 'border-border-secondary'
              }`}
            >
              <View className="flex-row items-center flex-1 mr-3">
                <Ionicons name="flash-outline" size={18} color="rgb(var(--primary))" className="mr-2.5" />
                <View className="flex-1">
                  <Text className="text-text-primary text-xs font-bold">{t('bookings.getIn40Mins')}</Text>
                  <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">{t('bookings.quickMatching')}</Text>
                </View>
              </View>
              <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                bookingTime === 'immediate' ? 'border-primary' : 'border-border-secondary'
              }`}>
                {bookingTime === 'immediate' && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBookingTime('later')}
              activeOpacity={0.85}
              className={`border rounded-2xl p-4 flex-row justify-between items-center ${
                bookingTime === 'later' ? 'border-primary bg-primary/5' : 'border-border-secondary'
              }`}
            >
              <View className="flex-row items-center flex-1 mr-3">
                <Ionicons name="calendar-outline" size={18} color="rgb(var(--brand-orange))" className="mr-2.5" />
                <View className="flex-1">
                  <Text className="text-text-primary text-xs font-bold">{t('bookings.scheduleLater')}</Text>
                  <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">{t('bookings.earliestSlot')}</Text>
                </View>
              </View>
              <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                bookingTime === 'later' ? 'border-primary' : 'border-border-secondary'
              }`}>
                {bookingTime === 'later' && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Professional Allocation */}
        <View className="mb-4">
          <Card variant="default" className="p-5">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">{t('bookings.partnerAllocation')}</Text>
            <View className="flex-row items-center border border-primary/10 bg-primary/5 rounded-2xl p-3.5">
              <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                <Ionicons name="people" size={18} color="rgb(var(--primary))" />
              </View>
              <View className="flex-1">
                <Text className="text-text-primary text-xs font-extrabold">{t('bookings.bestAvailable')}</Text>
                <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">{t('bookings.bestAvailableSub')}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="rgb(var(--primary))" />
            </View>
          </Card>
        </View>

        {/* Tipping segment */}
        <View className="mb-4">
          <Card variant="default" className="p-5">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-1">{t('bookings.addTipTitle')}</Text>
            <Text className="text-text-secondary text-[9px] font-medium mb-3">{t('bookings.addTipSub')}</Text>
            <View className="flex-row gap-2">
              {[25, 50, 100].map((tip) => {
                const isSelected = selectedTip === tip;
                return (
                  <TouchableOpacity
                    key={tip}
                    onPress={() => setSelectedTip(selectedTip === tip ? null : tip)}
                    activeOpacity={0.8}
                    className={`border rounded-xl px-4 py-2 ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-border-secondary'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-text-secondary'}`}>
                      ₹{tip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Payment Method */}
        <View className="mb-4">
          <Card variant="default" className="p-5">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">{t('bookings.paymentMethod')}</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setPaymentMode('COD')}
                activeOpacity={0.85}
                className={`flex-1 py-3 px-2 rounded-2xl border items-center flex-row justify-center space-x-1.5 ${
                  paymentMode === 'COD' ? 'border-primary bg-primary/10' : 'border-border-secondary'
                }`}
              >
                <Ionicons name="cash-outline" size={16} color={paymentMode === 'COD' ? 'rgb(var(--primary))' : 'rgb(var(--text-muted))'} />
                <Text className={`text-[10px] font-extrabold ${paymentMode === 'COD' ? 'text-primary' : 'text-text-secondary'}`}>
                  Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPaymentMode('ONLINE')}
                activeOpacity={0.85}
                className={`flex-1 py-3 px-2 rounded-2xl border items-center flex-row justify-center space-x-1.5 ${
                  paymentMode === 'ONLINE' ? 'border-primary bg-primary/10' : 'border-border-secondary'
                }`}
              >
                <Ionicons name="card-outline" size={16} color={paymentMode === 'ONLINE' ? 'rgb(var(--primary))' : 'rgb(var(--text-muted))'} />
                <Text className={`text-[10px] font-extrabold ${paymentMode === 'ONLINE' ? 'text-primary' : 'text-text-secondary'}`}>
                  Online
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPaymentMode('WALLET')}
                activeOpacity={0.85}
                className={`flex-1 py-3 px-2 rounded-2xl border items-center flex-row justify-center space-x-1.5 ${
                  paymentMode === 'WALLET' ? 'border-primary bg-primary/10' : 'border-border-secondary'
                }`}
              >
                <Ionicons name="wallet-outline" size={16} color={paymentMode === 'WALLET' ? 'rgb(var(--primary))' : 'rgb(var(--text-muted))'} />
                <Text className={`text-[10px] font-extrabold ${paymentMode === 'WALLET' ? 'text-primary' : 'text-text-secondary'}`}>
                  Wallet
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Notes */}
        <View className="mb-4">
          <Card variant="default" className="p-5">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">{t('bookings.serviceInstructions')}</Text>
            <TextInput
              placeholder={t('bookings.serviceInstructionsPlaceholder')}
              placeholderTextColor="rgb(var(--text-muted))"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              className="bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-xs h-16 focus:border-primary focus:bg-background-card"
              textAlignVertical="top"
            />
          </Card>
        </View>

        {/* Payment Summary */}
        {selectedItemData ? (
          <View className="mb-6">
            <Card variant="default" className="p-5">
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">{t('bookings.paymentSummary')}</Text>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary text-xs font-medium">{t('bookings.itemTotal')}</Text>
                <Text className="text-text-primary text-xs font-extrabold">₹{selectedItemData.base_price}</Text>
              </View>

              {selectedTip ? (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-text-secondary text-xs font-medium">{t('bookings.techTip')}</Text>
                  <Text className="text-text-primary text-xs font-extrabold">₹{selectedTip}</Text>
                </View>
              ) : null}

              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary text-xs font-medium">{t('bookings.feeTaxes')}</Text>
                <Text className="text-text-primary text-xs font-extrabold">₹{(selectedItemData.base_price * 0.15).toFixed(0)}</Text>
              </View>

              <View className="h-[1px] bg-border-primary my-2.5" />

              <View className="flex-row justify-between">
                <Text className="text-text-primary text-sm font-extrabold">{t('bookings.grandTotal')}</Text>
                <Text className="text-text-primary text-base font-black">
                  ₹{(selectedItemData.base_price * 1.15 + (selectedTip || 0)).toFixed(0)}
                </Text>
              </View>
            </Card>
          </View>
        ) : null}

        {/* Confirm Action Button */}
        <Button
          label={t('bookings.confirmRequest')}
          variant="primary"
          disabled={bookingMutation.isPending}
          loading={bookingMutation.isPending}
          size="lg"
          onPress={handleBook}
          className="w-full mb-12"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
