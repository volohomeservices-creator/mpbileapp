import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, TextInput, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getServices, createBooking } from '@/api/bookings';
import { CreateBookingSchema } from '@volo/shared-types';
import { getAddresses } from '@/api/profile';
import { getCustomerWallet } from '@/api/wallet';
import { apiPost, apiGet } from '@/api/client';
import { API_BASE_URL } from '@/config';
import { useLanguage } from '@/hooks/useLanguage';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCartStore } from '@/features/cart/cartStore';
import { getPublicMediaUrl } from '@/utils/media';
import { RazorpayModal, RazorpayPaymentData, RazorpaySuccessResponse } from '@/components/RazorpayModal';

// Platform-resilient showAlert helper supporting callbacks
const showAlert = (
  title: string,
  message: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
    if (buttons && buttons.length > 0) {
      const primaryButton = buttons[0];
      if (primaryButton.onPress) primaryButton.onPress();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

// Razorpay SDK Script loader for web
function loadRazorpayScript(): Promise<void> {
  if (Platform.OS !== 'web') {
    return Promise.resolve();
  }
  if (typeof window !== 'undefined' && (window as any).Razorpay) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }
    const existing = document.getElementById('razorpay-checkout-js') as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay checkout script.')));
      setTimeout(() => {
        if ((window as any).Razorpay) resolve();
        else resolve();
      }, 600);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay checkout script. Please check your internet connection.'));
    document.body.appendChild(script);
  });
}

// Universal Razorpay checkout opener
async function openRazorpayCheckout(checkout: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  bookingId?: string;
}): Promise<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }> {
  if (Platform.OS === 'web') {
    return loadRazorpayScript().then(() => new Promise((resolve, reject) => {
      const RazorpayCheckout = typeof window !== 'undefined' ? (window as any).Razorpay : null;
      if (!RazorpayCheckout) {
        reject(new Error('Razorpay SDK failed to load. Please check your internet connection.'));
        return;
      }
      const rzp = new RazorpayCheckout({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency || 'INR',
        name: checkout.name || 'VOLO Home Services',
        description: checkout.description || 'Service Booking Payment',
        order_id: checkout.orderId,
        theme: {
          color: '#3C01A7',
        },
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          resolve(response);
        },
        modal: {
          ondismiss: () => reject(new Error('Payment window was closed or dismissed.')),
        },
      });
      rzp.on('payment.failed', (response: any) => {
        reject(new Error(response?.error?.description || 'Payment transaction failed.'));
      });
      rzp.open();
    }));
  }

  // On Native Android / iOS, open inside an in-app browser sheet (never leaves the app)
  const returnUrl = Linking.createURL('payment-callback');
  const hostedUrl = `${API_BASE_URL}/api/customer/payments/checkout?order_id=${encodeURIComponent(checkout.orderId)}&key_id=${encodeURIComponent(checkout.keyId)}&amount=${encodeURIComponent(checkout.amount)}&currency=${encodeURIComponent(checkout.currency || 'INR')}&booking_id=${encodeURIComponent(checkout.bookingId || '')}&return_url=${encodeURIComponent(returnUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(hostedUrl, returnUrl, {
    showInRecents: false,
    preferEphemeralSession: true,
  });

  if (result.type === 'success' && result.url) {
    try {
      const parsedUrl = new URL(result.url);
      const razorpay_payment_id = parsedUrl.searchParams.get('razorpay_payment_id');
      const razorpay_order_id = parsedUrl.searchParams.get('razorpay_order_id') || checkout.orderId;
      const razorpay_signature = parsedUrl.searchParams.get('razorpay_signature') || '';

      if (razorpay_payment_id) {
        return {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        };
      }
    } catch {
      const match = result.url.match(/razorpay_payment_id=([^&]+)/);
      if (match && match[1]) {
        return {
          razorpay_order_id: checkout.orderId,
          razorpay_payment_id: decodeURIComponent(match[1]),
          razorpay_signature: '',
        };
      }
    }
  }

  throw new Error('Payment was cancelled or closed.');
}

export default function CreateBookingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { categoryId, serviceId, checkout } = useLocalSearchParams<{ 
    categoryId?: string; 
    serviceId?: string; 
    checkout?: string; 
  }>();
  const { t } = useLanguage();
  const {
    items: cartItems,
    addItem,
    removeItem,
    getItemQuantity,
    clearCart,
    getTotalCount,
    getTotalPrice,
  } = useCartStore();

  // UI Flow Step State ('catalog' = browsing services, 'checkout' = configure address, payment, notes)
  const [step, setStep] = useState<'catalog' | 'checkout'>('catalog');

  // Booking details state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<'ONLINE' | 'COD' | 'WALLET'>('COD');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [bookingTime, setBookingTime] = useState<'immediate' | 'later'>('immediate');
  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:00 AM - 11:00 AM');
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Photo attachments (Max 3, mirrors website flow)
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  // Promo Code state (mirrors website flow)
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeApplied, setPromoCodeApplied] = useState<any>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');

  // Payment processing state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [razorpayModalVisible, setRazorpayModalVisible] = useState(false);
  const [activeRazorpayData, setActiveRazorpayData] = useState<RazorpayPaymentData | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

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

  // Fetch Wallet details
  const { data: walletData } = useQuery({
    queryKey: ['customer-wallet'],
    queryFn: getCustomerWallet,
  });
  const walletBalance = Number(walletData?.wallet?.balance ?? 0);

  // Fetch live platform payment method availability
  const { data: paymentConfig } = useQuery({
    queryKey: ['payment-config'],
    queryFn: () => apiGet<any>('/api/public/payment-config'),
  });

  // Auto-switch payment mode if currently selected mode is disabled by platform admin
  useEffect(() => {
    if (paymentConfig) {
      if (paymentMode === 'COD' && paymentConfig.enable_cod_payment === false) {
        if (paymentConfig.enable_online_payment !== false) setPaymentMode('ONLINE');
        else if (paymentConfig.enable_wallet_payment !== false) setPaymentMode('WALLET');
      } else if (paymentMode === 'ONLINE' && paymentConfig.enable_online_payment === false) {
        if (paymentConfig.enable_wallet_payment !== false) setPaymentMode('WALLET');
        else if (paymentConfig.enable_cod_payment !== false) setPaymentMode('COD');
      } else if (paymentMode === 'WALLET' && paymentConfig.enable_wallet_payment === false) {
        if (paymentConfig.enable_online_payment !== false) setPaymentMode('ONLINE');
        else if (paymentConfig.enable_cod_payment !== false) setPaymentMode('COD');
      }
    }
  }, [paymentConfig, paymentMode]);

  // Categories & Items
  const categories = data?.categories ?? [];
  const allItems: any[] = categories.flatMap((c: any) => c.items ?? []);
  
  const isAllCategories = !categoryId || categoryId === 'all';
  const matchedCategory = categories.find((c) => c.id === categoryId);
  const currentCategory = matchedCategory || (isAllCategories ? { name: 'All Services', id: 'all' } : (categories.length > 0 ? categories[0] : null));
  
  // If user selected a specific category, show strictly that category's items (even if empty).
  // Only show allItems if categoryId is 'all' or not provided.
  const services = isAllCategories
    ? allItems
    : (matchedCategory ? (matchedCategory.items ?? []) : []);

  // React to incoming route parameters
  useEffect(() => {
    if (checkout === 'true' || serviceId) {
      setStep('checkout');
    }
    if (serviceId) {
      setSelectedService(serviceId);
    }
  }, [checkout, serviceId]);

  // If user enters checkout but no service is selected and cart is empty, auto-select first available service
  useEffect(() => {
    if (step === 'checkout' && !selectedService && cartItems.length === 0 && allItems.length > 0) {
      setSelectedService(allItems[0].id);
    }
  }, [step, selectedService, cartItems, allItems]);

  // Auto-fill default saved address if available
  useEffect(() => {
    if (savedAddresses.length > 0 && !address) {
      const defaultAddr = savedAddresses.find((a: any) => a.is_default) || savedAddresses[0];
      if (defaultAddr) {
        setAddress(defaultAddr.address);
        if (defaultAddr.latitude && defaultAddr.longitude) {
          setCoords({
            lat: Number(defaultAddr.latitude),
            lng: Number(defaultAddr.longitude),
          });
        }
      }
    }
  }, [savedAddresses, address]);

  // Get GPS location on mount if not already populated
  useEffect(() => {
    if (!address) {
      getLocation();
    }
    if (Platform.OS === 'web') {
      loadRazorpayScript().catch(() => {});
    }
  }, []);

  const getLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Location permission allows us to match the closest certified technician.');
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
          const resData = await res.json();
          if (resData && resData.address) {
            const addr = resData.address;
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

      setAddress(formattedAddress || 'Pinned Location (GPS Locked)');
    } catch (err) {
      console.warn('Failed to fetch location automatically:', err);
    } finally {
      setLocating(false);
    }
  };

  // Image Attachment Picker
  const handlePickImage = async () => {
    if (attachedImages.length >= 3) {
      showAlert('Limit Reached', 'You can attach up to 3 photos of the issue.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Needed', 'Please allow camera / gallery access to upload photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachedImages((prev) => [...prev, result.assets[0].uri].slice(0, 3));
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handleRemoveImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Pricing calculations
  const effectiveServiceId = selectedService || (cartItems.length > 0 ? cartItems[0].id : null);
  const selectedItemData = services.find((s: any) => s.id === effectiveServiceId) ||
    allItems.find((s: any) => s.id === effectiveServiceId);

  const rawItemTotal = cartItems.length > 0 
    ? getTotalPrice() 
    : Number(selectedItemData?.base_price ?? 0);

  // Authoritative backend pricing breakdown
  const { data: pricingData } = useQuery({
    queryKey: ['pricing-breakdown', rawItemTotal, effectiveServiceId],
    queryFn: async () => {
      return apiPost<any>('/api/pricing/calculate', {
        serviceAmount: rawItemTotal,
        serviceId: effectiveServiceId,
      });
    },
    enabled: rawItemTotal > 0,
  });

  const isPlatformFeeEnabled = pricingData ? pricingData.platformFeeEnabled : true;
  const platformFee = pricingData ? Number(pricingData.platformFee || 0) : Math.round(rawItemTotal * 0.10);
  const platformFeeLabel = pricingData?.platformFeeLabel || 'Platform Fee';
  const isTaxEnabled = pricingData ? pricingData.taxEnabled : true;
  const tax = pricingData ? Number(pricingData.taxAmount || 0) : Math.round(rawItemTotal * 0.05);
  const taxLabel = pricingData?.taxLabel || 'GST (5%)';
  const discountAmount = promoCodeApplied ? Number(promoCodeApplied.discount_amount || 0) : 0;
  const tipAmount = selectedTip || 0;
  const grandTotal = Math.max(0, rawItemTotal + (isPlatformFeeEnabled ? platformFee : 0) + (isTaxEnabled ? tax : 0) - discountAmount + tipAmount);
  const isWalletInsufficient = paymentMode === 'WALLET' && walletBalance < grandTotal;

  // Promo code validation
  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setPromoError('');
    setValidatingPromo(true);
    try {
      const res = await apiPost<any>('/api/customer/promo-validate', {
        code: promoCodeInput.trim().toUpperCase(),
        order_amount: rawItemTotal + (isPlatformFeeEnabled ? platformFee : 0) + (isTaxEnabled ? tax : 0),
      });
      if (res && res.discount_amount !== undefined) {
        setPromoCodeApplied(res);
        setPromoCodeInput('');
      } else {
        setPromoError(res?.error || 'Invalid promo code');
      }
    } catch (err: any) {
      setPromoError(err?.response?.data?.error || err.message || 'Invalid promo code');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCodeApplied(null);
    setPromoError('');
  };

  const handlePaymentSuccess = async (paymentResponse: RazorpaySuccessResponse, targetBookingId?: string) => {
    setRazorpayModalVisible(false);
    setIsProcessingPayment(true);
    const bookingId = targetBookingId || pendingBookingId;
    try {
      const verifyRes = await apiPost<{ success: boolean; bookingId: string }>(
        '/api/customer/payments/verify',
        paymentResponse
      );

      if (verifyRes && verifyRes.success) {
        clearCart();
        showAlert('Payment Successful!', 'Your booking has been placed and payment confirmed. Matching nearest technician!', [
          {
            text: 'Track Booking',
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['customer-active-bookings'] });
              router.replace(`/(customer)/bookings/${verifyRes.bookingId || bookingId}`);
            },
          },
        ]);
      } else {
        showAlert('Payment Pending Verification', 'Your payment was submitted and is being recorded.', [
          {
            text: 'Track Booking',
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['customer-active-bookings'] });
              router.replace(`/(customer)/bookings/${bookingId}`);
            },
          },
        ]);
      }
    } catch (payErr: any) {
      showAlert('Payment Submitted', payErr?.message || 'Payment was recorded and is being verified.');
      if (bookingId) {
        router.replace(`/(customer)/bookings/${bookingId}`);
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePaymentDismiss = (targetBookingId?: string) => {
    setRazorpayModalVisible(false);
    setIsProcessingPayment(false);
    const bookingId = targetBookingId || pendingBookingId;
    if (bookingId) {
      showAlert(
        'Payment Incomplete',
        'Payment was not completed. Technician dispatch will occur after payment confirmation.',
        [
          {
            text: 'View Booking',
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['customer-active-bookings'] });
              router.replace(`/(customer)/bookings/${bookingId}`);
            },
          },
          {
            text: 'Close',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const handlePaymentError = (errMsg: string) => {
    setRazorpayModalVisible(false);
    setIsProcessingPayment(false);
    showAlert('Payment Failed', errMsg || 'Payment was not completed.');
  };

  // Mutation to place booking
  const bookingMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: async (res) => {
      if (res.success && res.razorpay) {
        if (Platform.OS === 'web') {
          setIsProcessingPayment(true);
          try {
            const paymentResponse = await openRazorpayCheckout({
              keyId: res.razorpay.keyId,
              orderId: res.razorpay.orderId,
              amount: res.razorpay.amount,
              currency: res.razorpay.currency || 'INR',
              name: 'VOLO Home Services',
              description: selectedItemData?.name ? `Booking - ${selectedItemData.name}` : 'Service Booking Payment',
              bookingId: res.bookingId,
            });
            await handlePaymentSuccess(paymentResponse, res.bookingId);
          } catch (payErr: any) {
            handlePaymentDismiss(res.bookingId);
          }
        } else {
          // Native Mobile: Open in-app Razorpay modal (stays 100% inside mobile app)
          setPendingBookingId(res.bookingId);
          setActiveRazorpayData({
            keyId: res.razorpay.keyId,
            orderId: res.razorpay.orderId,
            amount: res.razorpay.amount,
            currency: res.razorpay.currency || 'INR',
            name: 'VOLO Home Services',
            description: selectedItemData?.name ? `Booking - ${selectedItemData.name}` : 'Service Booking Payment',
          });
          setRazorpayModalVisible(true);
        }
        return;
      }
      if (res.success) {
        clearCart();
        showAlert('Booking Placed', 'Your service booking has been created successfully. Matching the nearest technician!', [
          {
            text: 'Track Booking',
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
    if (!effectiveServiceId) {
      showAlert('Service Required', 'Please select a service to proceed.');
      return;
    }

    if (!address || address.trim().length < 5) {
      showAlert('Address Required', 'Please specify a service delivery location address (minimum 5 characters).');
      return;
    }

    if (isWalletInsufficient) {
      showAlert(
        'Insufficient Wallet Balance',
        `Your wallet balance is ₹${walletBalance.toFixed(0)}, but grand total is ₹${grandTotal.toFixed(0)}. Please choose Cash, Online Pay, or top up wallet.`
      );
      return;
    }

    let scheduledAtVal: string | null = null;
    if (bookingTime === 'later') {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + selectedDateOffset);
      const slotHour = selectedTimeSlot.includes('09:00 AM') ? 9 
        : selectedTimeSlot.includes('11:00 AM') ? 11 
        : selectedTimeSlot.includes('02:00 PM') ? 14 
        : selectedTimeSlot.includes('04:00 PM') ? 16 
        : 18;
      targetDate.setHours(slotHour, 0, 0, 0);
      scheduledAtVal = targetDate.toISOString();
    }

    const payload = {
      service_item_id: effectiveServiceId,
      address: address.trim(),
      latitude: coords?.lat ?? 17.3850,
      longitude: coords?.lng ?? 78.4867,
      payment_mode: paymentMode,
      notes: notes.trim() || undefined,
      scheduled_at: scheduledAtVal,
      promo_code: promoCodeApplied?.code || undefined,
    };

    const validation = CreateBookingSchema.safeParse({
      service_item_id: payload.service_item_id,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      payment_mode: payload.payment_mode,
      notes: payload.notes,
    });

    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || 'Validation error';
      showAlert('Validation Error', errorMsg);
      return;
    }

    bookingMutation.mutate(payload as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#3C01A7" />
        <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // STEP 1: SERVICE CATALOG / SERVICE SELECTION PAGE
  // =========================================================================
  if (step === 'catalog') {
    return (
      <View className="flex-1 bg-white">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header Image Slider */}
          <View className="relative h-60 bg-slate-900">
            {((currentCategory as any)?.icon_url || (currentCategory as any)?.image_url) ? (
              <Image
                source={{
                  uri: getPublicMediaUrl((currentCategory as any)?.icon_url || (currentCategory as any)?.image_url, 'service-images')!,
                }}
                className="w-full h-full opacity-90"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full bg-[#18073E] items-center justify-center">
                <Ionicons name="sparkles" size={48} color="#A78BFA" />
              </View>
            )}
            <View className="absolute inset-0 bg-black/35" />

            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="absolute left-6 top-12 w-9 h-9 rounded-full bg-white justify-center items-center shadow-premium border border-border-primary"
            >
              <Ionicons name="arrow-back" size={18} color="#1E1535" />
            </TouchableOpacity>

            {/* Overlay Cart Button */}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/cart' as any)}
              activeOpacity={0.8}
              className="absolute right-6 top-12 w-9 h-9 rounded-full bg-white justify-center items-center shadow-premium border border-border-primary"
            >
              <Ionicons name="cart-outline" size={18} color="#3C01A7" />
              {getTotalCount() > 0 && (
                <View className="absolute -top-1 -right-1 bg-rose-500 rounded-full w-4 h-4 justify-center items-center border border-white">
                  <Text className="text-white text-[9px] font-black">{getTotalCount()}</Text>
                </View>
              )}
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
                <Ionicons name="star" size={14} color="#FF9F2E" />
                <Text className="text-text-primary text-xs font-bold ml-1">
                  {(currentCategory as any)?.average_rating ?? '4.8'}
                </Text>
                <Text className="text-text-muted text-xs font-medium ml-1">
                  ({(currentCategory as any)?.total_reviews ?? '5'} reviews)
                </Text>
              </View>
              <View className="w-1 h-1 rounded-full bg-border-secondary" />
              <Text className="text-text-secondary text-xs font-medium">
                {(currentCategory as any)?.total_bookings ?? '12'} bookings this week
              </Text>
            </View>

            {/* Highly trained badge */}
            <View className="border border-border-secondary rounded-2xl p-4 flex-row justify-between items-center bg-background-secondary">
              <View className="flex-row items-center">
                <Ionicons name="trophy-outline" size={16} color="#FF9F2E" style={{ marginRight: 8 }} />
                <Text className="text-text-secondary text-xs font-bold">{t('bookings.highlyTrained')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#8E84B0" />
            </View>
          </View>

          {/* User Guide Tip */}
          <View className="mx-6 my-3.5 p-3.5 bg-[#F4EFFE] rounded-2xl border border-[#3C01A7]/15 flex-row items-center">
            <Ionicons name="information-circle" size={18} color="#3C01A7" style={{ marginRight: 10 }} />
            <Text className="text-[#3C01A7] text-xs font-semibold flex-1 leading-4">
              Tap any service or tap <Text className="font-extrabold">"Book Now"</Text> to configure address, notes & payment mode.
            </Text>
          </View>

          {/* Services list */}
          <View className="px-5 pb-5 bg-background-secondary mb-24">
            <View className="flex-row items-center justify-between mb-3.5 px-1">
              <Text className="text-text-secondary text-xs font-black uppercase tracking-wider">
                {t('bookings.chooseOptions')} ({services.length})
              </Text>
              <Text className="text-[#3C01A7] text-[11px] font-bold">
                Best Prices Guaranteed
              </Text>
            </View>
            {services.length === 0 ? (
              <View className="bg-white rounded-3xl p-8 items-center border border-border-primary shadow-xs my-2">
                <View className="w-16 h-16 rounded-2xl bg-[#F0EBFB] items-center justify-center mb-3.5 border border-purple-100">
                  <Ionicons name="construct-outline" size={32} color="#3C01A7" />
                </View>
                <Text className="text-text-primary text-base font-extrabold text-center mb-1">
                  No Services Available
                </Text>
                <Text className="text-text-secondary text-xs text-center mb-5 max-w-[260px] leading-relaxed">
                  There are currently no active services listed under {currentCategory?.name || 'this category'}.
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace('/(customer)/bookings/create?categoryId=all')}
                  activeOpacity={0.85}
                  style={{ backgroundColor: '#3C01A7' }}
                  className="px-5 py-2.5 rounded-xl shadow-xs flex-row items-center"
                >
                  <Text className="text-white text-xs font-black mr-1.5">View All Available Services</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              services.map((item: any) => {
                const cartQty = getItemQuantity(item.id);
                const serviceImg = getPublicMediaUrl(item.icon_url || item.image_url, 'service-images');
                return (
                  <View
                    key={item.id}
                    className="mb-4 bg-white rounded-3xl border border-border-primary/80 shadow-xs overflow-hidden"
                    style={{
                      shadowColor: '#18073E',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    {/* Full-width Service Cover Image */}
                    {serviceImg ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                          setSelectedService(item.id);
                          if (cartQty === 0) {
                            addItem({
                              id: item.id,
                              name: item.name,
                              description: item.description,
                              base_price: Number(item.base_price),
                              estimated_mins: item.estimated_mins,
                              category_id: item.category_id,
                              category_name: currentCategory?.name,
                            });
                          }
                          setStep('checkout');
                        }}
                        className="w-full h-40 bg-[#F0EBFB] relative overflow-hidden"
                      >
                        <Image
                          source={{ uri: serviceImg }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.3)']}
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40 }}
                        />
                      </TouchableOpacity>
                    ) : null}

                    {/* Service Content & Details */}
                    <View className="p-4">
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedService(item.id);
                          if (cartQty === 0) {
                            addItem({
                              id: item.id,
                              name: item.name,
                              description: item.description,
                              base_price: Number(item.base_price),
                              estimated_mins: item.estimated_mins,
                              category_id: item.category_id,
                              category_name: currentCategory?.name,
                            });
                          }
                          setStep('checkout');
                        }}
                      >
                        <Text className="text-text-primary text-base font-extrabold leading-snug mb-1" numberOfLines={2}>
                          {item.name}
                        </Text>
                        {item.description ? (
                          <Text className="text-text-secondary text-xs leading-4 mb-2" numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                        <View className="flex-row items-center gap-2">
                          <View className="flex-row items-center bg-[#F8F6FD] px-2.5 py-0.5 rounded-lg border border-purple-100 self-start">
                            <Ionicons name="time-outline" size={12} color="#6B21A8" />
                            <Text className="text-[#6B21A8] text-[11px] font-bold ml-1">
                              {item.estimated_mins || 45} mins
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Subtle Divider */}
                      <View className="h-px bg-[#F1EDF9] my-3.5" />
                    </View>

                    {/* Bottom Row: Price & Actions */}
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Price</Text>
                        <Text className="text-text-primary text-lg font-black tracking-tight">₹{item.base_price}</Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        {/* Add to Cart Stepper / Button */}
                        {cartQty > 0 ? (
                          <View className="flex-row items-center border border-[#3C01A7] bg-[#F0EBFB] rounded-xl px-2 py-1.5 shadow-xs">
                            <TouchableOpacity
                              onPress={() => removeItem(item.id)}
                              activeOpacity={0.7}
                              className="w-6 h-6 rounded-lg bg-white justify-center items-center shadow-xs"
                            >
                              <Ionicons name="remove" size={13} color="#3C01A7" />
                            </TouchableOpacity>
                            <Text className="text-[#3C01A7] text-xs font-black px-2.5 min-w-[22px] text-center">{cartQty}</Text>
                            <TouchableOpacity
                              onPress={() => addItem({
                                id: item.id,
                                name: item.name,
                                description: item.description,
                                base_price: Number(item.base_price),
                                estimated_mins: item.estimated_mins,
                                category_id: item.category_id,
                                category_name: currentCategory?.name,
                              })}
                              activeOpacity={0.7}
                              className="w-6 h-6 rounded-lg bg-[#3C01A7] justify-center items-center shadow-xs"
                            >
                              <Ionicons name="add" size={13} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              addItem({
                                id: item.id,
                                name: item.name,
                                description: item.description,
                                base_price: Number(item.base_price),
                                estimated_mins: item.estimated_mins,
                                category_id: item.category_id,
                                category_name: currentCategory?.name,
                              });
                            }}
                            activeOpacity={0.8}
                            className="flex-row items-center border border-[#3C01A7] bg-[#F0EBFB] rounded-xl px-3 py-2 active:bg-[#3C01A7]/20 shadow-xs"
                          >
                            <Ionicons name="cart-outline" size={13} color="#3C01A7" style={{ marginRight: 4 }} />
                            <Text className="text-[#3C01A7] text-xs font-black">+ Cart</Text>
                          </TouchableOpacity>
                        )}

                        {/* Instant Book Now Button */}
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedService(item.id);
                            if (cartQty === 0) {
                              addItem({
                                id: item.id,
                                name: item.name,
                                description: item.description,
                                base_price: Number(item.base_price),
                                estimated_mins: item.estimated_mins,
                                category_id: item.category_id,
                                category_name: currentCategory?.name,
                              });
                            }
                            setStep('checkout');
                          }}
                          activeOpacity={0.85}
                          style={{ backgroundColor: '#3C01A7' }}
                          className="flex-row items-center px-4 py-2 rounded-xl shadow-xs"
                        >
                          <Text className="text-white text-xs font-black mr-1">Book Now</Text>
                          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Floating bottom checkout bar */}
        {getTotalCount() > 0 ? (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border-primary px-5 py-3.5 flex-row justify-between items-center shadow-premium">
            <View>
              <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider">
                {getTotalCount()} {getTotalCount() === 1 ? t('bookings.itemInCart') : t('bookings.itemsInCart')}
              </Text>
              <Text className="text-[#3C01A7] text-lg font-black">₹{getTotalPrice()}</Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => router.push('/(customer)/cart' as any)}
                activeOpacity={0.85}
                className="px-4 py-2.5 rounded-xl border border-[#3C01A7] bg-[#F0EBFB] flex-row items-center"
              >
                <Ionicons name="cart-outline" size={16} color="#3C01A7" style={{ marginRight: 4 }} />
                <Text className="text-[#3C01A7] text-xs font-extrabold">{t('bookings.viewCart')}</Text>
              </TouchableOpacity>
              <Button
                label={t('bookings.proceedToCheckout')}
                variant="primary"
                size="md"
                onPress={() => {
                  if (!selectedService && cartItems.length > 0) {
                    setSelectedService(cartItems[0].id);
                  }
                  setStep('checkout');
                }}
                className="px-4"
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // =========================================================================
  // STEP 2: BOOKING CONFIGURATION SCREEN (Address, Mode of Payment, Notes)
  // Mirroring the Website Flow (`/customer/services/view`)
  // =========================================================================
  return (
    <SafeAreaView className="flex-1 bg-[#F8F7FC]" edges={['top']}>
      {/* Top Navigation Bar */}
      <View className="px-5 py-4 flex-row items-center border-b border-border-primary bg-white shadow-xs">
        <TouchableOpacity
          onPress={() => setStep('catalog')}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="#1E1535" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text-primary text-base font-black">Book Service</Text>
          <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider font-mono">
            Configure Request Details
          </Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-5 pt-4" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Selected Service Card */}
        {cartItems.length > 0 ? (
          <View className="mb-4">
            <Card variant="default" className="p-4 border border-[#3C01A7]/20 bg-[#F0EBFB]/40">
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-2.5">
                Service Details ({cartItems.length})
              </Text>
              {cartItems.map((c) => (
                <View key={c.id} className="flex-row justify-between items-center py-2 border-b border-border-primary/50 last:border-b-0">
                  <View className="flex-1 mr-2">
                    <Text className="text-text-primary text-xs font-black">{c.name}</Text>
                    <Text className="text-text-secondary text-[10px] font-semibold">Qty: {c.quantity} • ₹{c.base_price} each</Text>
                  </View>
                  <Text className="text-[#3C01A7] text-xs font-black">₹{c.base_price * c.quantity}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : selectedItemData ? (
          <View className="mb-4">
            <Card variant="default" className="p-4 flex-row justify-between items-center border border-[#3C01A7]/20 bg-[#F0EBFB]/40">
              <View className="flex-1 mr-3">
                <Text className="text-text-primary text-sm font-black">{selectedItemData.name}</Text>
                <Text className="text-text-secondary text-[11px] font-semibold mt-0.5">⏱ {selectedItemData.estimated_mins} mins</Text>
              </View>
              <Text className="text-[#3C01A7] text-base font-black">₹{selectedItemData.base_price}</Text>
            </Card>
          </View>
        ) : null}

        {/* STEP 1: Select Schedule Type */}
        <View className="mb-4">
          <Card variant="default" className="p-4">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">
              1. Select Schedule Type
            </Text>
            
            <TouchableOpacity
              onPress={() => setBookingTime('immediate')}
              activeOpacity={0.85}
              className={`border rounded-2xl p-3.5 mb-2.5 flex-row justify-between items-center ${
                bookingTime === 'immediate' ? 'border-[#3C01A7] bg-[#F0EBFB]' : 'border-border-secondary'
              }`}
            >
              <View className="flex-row items-center flex-1 mr-3">
                <Ionicons name="flash-outline" size={18} color="#3C01A7" style={{ marginRight: 10 }} />
                <View className="flex-1">
                  <Text className="text-text-primary text-xs font-black">Instant Booking (30-45 mins)</Text>
                  <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">Dispatches nearest certified technician immediately</Text>
                </View>
              </View>
              <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                bookingTime === 'immediate' ? 'border-[#3C01A7]' : 'border-border-secondary'
              }`}>
                {bookingTime === 'immediate' && <View className="w-2.5 h-2.5 rounded-full bg-[#3C01A7]" />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBookingTime('later')}
              activeOpacity={0.85}
              className={`border rounded-2xl p-3.5 flex-row justify-between items-center ${
                bookingTime === 'later' ? 'border-[#3C01A7] bg-[#F0EBFB]' : 'border-border-secondary'
              }`}
            >
              <View className="flex-row items-center flex-1 mr-3">
                <Ionicons name="calendar-outline" size={18} color="#FF9F2E" style={{ marginRight: 10 }} />
                <View className="flex-1">
                  <Text className="text-text-primary text-xs font-black">Schedule Future</Text>
                  <Text className="text-text-secondary text-[9px] font-semibold mt-0.5">Select upcoming date & time slot</Text>
                </View>
              </View>
              <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                bookingTime === 'later' ? 'border-[#3C01A7]' : 'border-border-secondary'
              }`}>
                {bookingTime === 'later' && <View className="w-2.5 h-2.5 rounded-full bg-[#3C01A7]" />}
              </View>
            </TouchableOpacity>

            {bookingTime === 'later' && (
              <View className="mt-3.5 pt-3.5 border-t border-border-secondary">
                {/* Real Upcoming Dates Selection */}
                <Text className="text-text-primary text-[11px] font-black uppercase tracking-wider mb-2">
                  Select Date
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3.5">
                  {[0, 1, 2, 3].map((offset) => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    const isSelected = selectedDateOffset === offset;
                    const dayLabel = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
                    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                      <TouchableOpacity
                        key={offset}
                        onPress={() => setSelectedDateOffset(offset)}
                        activeOpacity={0.8}
                        className={`mr-2.5 px-3.5 py-2 rounded-2xl border items-center min-w-[76px] ${
                          isSelected 
                            ? 'bg-[#3C01A7] border-[#3C01A7] shadow-xs' 
                            : 'bg-background-secondary border-border-secondary'
                        }`}
                      >
                        <Text className={`text-[10px] font-black uppercase ${isSelected ? 'text-white' : 'text-text-muted'}`}>
                          {dayLabel}
                        </Text>
                        <Text className={`text-xs font-black mt-0.5 ${isSelected ? 'text-white' : 'text-text-primary'}`}>
                          {dateLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Real Time Slots Selection */}
                <Text className="text-text-primary text-[11px] font-black uppercase tracking-wider mb-2">
                  Select Time Window
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    '09:00 AM - 11:00 AM',
                    '11:00 AM - 01:00 PM',
                    '02:00 PM - 04:00 PM',
                    '04:00 PM - 06:00 PM',
                    '06:00 PM - 08:00 PM',
                  ].map((slot) => {
                    const isSelected = selectedTimeSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        onPress={() => setSelectedTimeSlot(slot)}
                        activeOpacity={0.8}
                        className={`px-3 py-2 rounded-xl border ${
                          isSelected 
                            ? 'bg-[#F0EBFB] border-[#3C01A7]' 
                            : 'bg-background-secondary border-border-secondary'
                        }`}
                      >
                        <Text className={`text-[10px] font-black ${isSelected ? 'text-[#3C01A7]' : 'text-text-secondary'}`}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* STEP 2: Choose Service Location Address */}
        <View className="mb-4">
          <Card variant="default" className="p-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Ionicons name="location-outline" size={16} color="#3C01A7" style={{ marginRight: 6 }} />
                <Text className="text-text-primary text-xs font-black uppercase tracking-wider">
                  2. Service Delivery Address
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditingAddress(!isEditingAddress)} activeOpacity={0.8}>
                <Text className="text-[#3C01A7] text-xs font-black">
                  {isEditingAddress ? 'Done' : 'Edit Address'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingAddress ? (
              <TextInput
                value={address}
                onChangeText={setAddress}
                className="bg-white border border-[#3C01A7] rounded-xl p-3 text-text-primary text-xs h-20 shadow-xs"
                multiline
                placeholder="Door/Flat no, Street, Landmark, City..."
                placeholderTextColor="#8E84B0"
              />
            ) : (
              <Text className="text-text-secondary text-xs font-bold leading-5 bg-background-secondary p-3 rounded-xl border border-border-secondary">
                {address || 'Awaiting location input...'}
              </Text>
            )}

            {/* GPS Lock status */}
            {coords ? (
              <Text className="text-text-muted text-[9px] font-mono mt-2">
                📍 GPS Lock: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            ) : (
              <View className="flex-row items-center mt-2">
                <ActivityIndicator size="small" color="#FF9F2E" style={{ marginRight: 6 }} />
                <Text className="text-warning text-[10px] font-bold">Acquiring live coordinates...</Text>
              </View>
            )}

            {/* Saved Addresses chips (Instant 1-tap select) */}
            {savedAddresses.length > 0 && (
              <View className="mt-3.5">
                <Text className="text-text-muted text-[9px] font-black uppercase tracking-wider mb-2">
                  Saved Addresses ({savedAddresses.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                  {savedAddresses.map((addr: any) => {
                    const isSelected = address.trim() === addr.address.trim();
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        onPress={() => {
                          setAddress(addr.address);
                          if (addr.latitude && addr.longitude) {
                            setCoords({ lat: Number(addr.latitude), lng: Number(addr.longitude) });
                          }
                        }}
                        activeOpacity={0.9}
                        className={`mr-2.5 px-3 py-1.5 rounded-xl border flex-row items-center active:scale-95 ${
                          isSelected 
                            ? 'bg-[#3C01A7]/10 border-[#3C01A7]' 
                            : 'bg-background-secondary border-border-secondary'
                        }`}
                      >
                        <Ionicons 
                          name={addr.label.toLowerCase() === 'home' ? 'home-outline' : addr.label.toLowerCase() === 'work' ? 'business-outline' : 'location-outline'} 
                          size={12} 
                          color={isSelected ? '#3C01A7' : '#584F75'} 
                          style={{ marginRight: 4 }}
                        />
                        <Text className={`text-[10px] font-bold ${isSelected ? 'text-[#3C01A7]' : 'text-text-secondary'}`}>
                          {addr.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Live GPS Re-detect button */}
            <TouchableOpacity
              onPress={getLocation}
              disabled={locating}
              activeOpacity={0.8}
              className="mt-3 py-2.5 rounded-xl bg-[#F0EBFB] border border-[#3C01A7]/30 flex-row items-center justify-center"
            >
              {locating ? (
                <ActivityIndicator size="small" color="#3C01A7" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="navigate-outline" size={14} color="#3C01A7" style={{ marginRight: 6 }} />
              )}
              <Text className="text-[#3C01A7] text-[10px] font-black">
                {locating ? 'Detecting GPS...' : '📍 Use Current GPS Location'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* STEP 3: Customer Notes & Photo Attachments */}
        <View className="mb-4">
          <Card variant="default" className="p-4">
            <View className="flex-row items-center mb-2.5">
              <Ionicons name="document-text-outline" size={16} color="#3C01A7" style={{ marginRight: 6 }} />
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider">
                3. Customer Notes & Attachments
              </Text>
            </View>

            <TextInput
              placeholder="Describe specific issues, gate codes, or directions..."
              placeholderTextColor="#8E84B0"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              className="bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-xs h-20 mb-3"
              textAlignVertical="top"
            />

            {/* Photo Attachments Row */}
            <View className="pt-2 border-t border-border-primary">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-text-secondary text-[10px] font-black uppercase tracking-wider">
                  Photos of the Issue (Max 3)
                </Text>
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={attachedImages.length >= 3}
                  activeOpacity={0.8}
                  className="flex-row items-center bg-[#F0EBFB] px-2.5 py-1 rounded-lg border border-[#3C01A7]/30"
                >
                  <Ionicons name="camera-outline" size={12} color="#3C01A7" style={{ marginRight: 4 }} />
                  <Text className="text-[#3C01A7] text-[10px] font-black">
                    {attachedImages.length >= 3 ? 'Max 3' : '+ Add Photo'}
                  </Text>
                </TouchableOpacity>
              </View>

              {attachedImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mt-1">
                  {attachedImages.map((uri, idx) => (
                    <View key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border-secondary mr-2">
                      <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                      <TouchableOpacity
                        onPress={() => handleRemoveImage(idx)}
                        activeOpacity={0.8}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 justify-center items-center"
                      >
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </Card>
        </View>

        {/* STEP 4: Select Payment Method */}
        <View className="mb-4">
          <Card variant="default" className="p-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="wallet-outline" size={16} color="#3C01A7" style={{ marginRight: 6 }} />
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider">
                4. Select Payment Method
              </Text>
            </View>

            <View className="flex-row gap-2">
              {paymentConfig?.enable_cod_payment !== false && (
                <TouchableOpacity
                  onPress={() => setPaymentMode('COD')}
                  activeOpacity={0.85}
                  className={`flex-1 py-3 px-2 rounded-2xl border items-center flex-row justify-center space-x-1.5 ${
                    paymentMode === 'COD' ? 'border-[#3C01A7] bg-[#F0EBFB]' : 'border-border-secondary bg-white'
                  }`}
                >
                  <Ionicons name="cash-outline" size={16} color={paymentMode === 'COD' ? '#3C01A7' : '#8E84B0'} />
                  <Text className={`text-[10px] font-black ${paymentMode === 'COD' ? 'text-[#3C01A7]' : 'text-text-secondary'}`}>
                    Cash
                  </Text>
                </TouchableOpacity>
              )}

              {paymentConfig?.enable_online_payment !== false && (
                <TouchableOpacity
                  onPress={() => setPaymentMode('ONLINE')}
                  activeOpacity={0.85}
                  className={`flex-1 py-3 px-2 rounded-2xl border items-center flex-row justify-center space-x-1.5 ${
                    paymentMode === 'ONLINE' ? 'border-[#3C01A7] bg-[#F0EBFB]' : 'border-border-secondary bg-white'
                  }`}
                >
                  <Ionicons name="card-outline" size={16} color={paymentMode === 'ONLINE' ? '#3C01A7' : '#8E84B0'} />
                  <Text className={`text-[10px] font-black ${paymentMode === 'ONLINE' ? 'text-[#3C01A7]' : 'text-text-secondary'}`}>
                    Online Pay
                  </Text>
                </TouchableOpacity>
              )}

              {paymentConfig?.enable_wallet_payment !== false && (
                <TouchableOpacity
                  onPress={() => setPaymentMode('WALLET')}
                  activeOpacity={0.85}
                  className={`flex-1 py-3 px-2 rounded-2xl border items-center flex-row justify-center space-x-1.5 ${
                    paymentMode === 'WALLET' ? 'border-[#3C01A7] bg-[#F0EBFB]' : 'border-border-secondary bg-white'
                  }`}
                >
                  <Ionicons name="wallet-outline" size={16} color={paymentMode === 'WALLET' ? '#3C01A7' : '#8E84B0'} />
                  <Text className={`text-[10px] font-black ${paymentMode === 'WALLET' ? 'text-[#3C01A7]' : 'text-text-secondary'}`}>
                    Wallet
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Wallet Balance Display & Warning */}
            <View className="mt-2.5 pt-2 border-t border-border-primary flex-row justify-between items-center">
              <Text className="text-text-secondary text-[10px] font-semibold">
                Volo Wallet Balance: <Text className="text-text-primary font-black">₹{walletBalance.toFixed(0)}</Text>
              </Text>
              {paymentMode === 'WALLET' && isWalletInsufficient && (
                <Text className="text-rose-600 text-[10px] font-black">
                  Short by ₹{(grandTotal - walletBalance).toFixed(0)}
                </Text>
              )}
            </View>

            {isWalletInsufficient && paymentMode === 'WALLET' && (
              <View className="mt-2 p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                <Text className="text-rose-700 text-[10px] font-bold">
                  ⚠️ Insufficient wallet balance. Please switch to Cash / Online Pay or recharge your wallet.
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* STEP 5: Bill & Payment Summary */}
        <View className="mb-6">
          <Card variant="default" className="p-4">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">
              5. Bill & Payment Summary
            </Text>
            
            <View className="flex-row justify-between mb-2">
              <Text className="text-text-secondary text-xs font-semibold">{t('bookings.itemTotal')}</Text>
              <Text className="text-text-primary text-xs font-black">₹{rawItemTotal}</Text>
            </View>

            {isPlatformFeeEnabled && platformFee > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary text-xs font-semibold">{platformFeeLabel}</Text>
                <Text className="text-text-primary text-xs font-black">₹{platformFee}</Text>
              </View>
            )}

            {isTaxEnabled && tax > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary text-xs font-semibold">{taxLabel}</Text>
                <Text className="text-text-primary text-xs font-black">₹{tax}</Text>
              </View>
            )}

            {/* Promo Code Input & Discount */}
            <View className="my-2 py-2 border-t border-b border-border-primary">
              {promoCodeApplied ? (
                <View className="flex-row justify-between items-center bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <View className="flex-row items-center">
                    <Ionicons name="pricetag" size={14} color="#059669" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-800 text-xs font-black">
                      {promoCodeApplied.code} applied (-₹{discountAmount})
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleRemovePromo} activeOpacity={0.8}>
                    <Text className="text-rose-600 text-xs font-black">Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View className="flex-row gap-2">
                    <TextInput
                      value={promoCodeInput}
                      onChangeText={(val) => {
                        setPromoCodeInput(val);
                        setPromoError('');
                      }}
                      placeholder="Enter promo coupon code..."
                      placeholderTextColor="#8E84B0"
                      autoCapitalize="characters"
                      className="flex-1 bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-black text-text-primary"
                    />
                    <TouchableOpacity
                      onPress={handleApplyPromo}
                      disabled={validatingPromo || !promoCodeInput.trim()}
                      activeOpacity={0.8}
                      className="px-4 py-2 rounded-xl bg-[#3C01A7] justify-center items-center"
                    >
                      {validatingPromo ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-white text-xs font-black">Apply</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {promoError ? (
                    <Text className="text-rose-600 text-[10px] font-bold mt-1 ml-1">{promoError}</Text>
                  ) : null}
                </View>
              )}
            </View>

            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-text-primary text-sm font-black">{t('bookings.grandTotal')}</Text>
              <Text className="text-[#3C01A7] text-lg font-black">₹{grandTotal}</Text>
            </View>
          </Card>
        </View>

        {/* Confirm Action Button */}
        <Button
          label={
            isProcessingPayment
              ? 'Opening Payment...'
              : `Confirm Booking • ₹${grandTotal}`
          }
          variant="primary"
          disabled={bookingMutation.isPending || isProcessingPayment || isWalletInsufficient}
          loading={bookingMutation.isPending || isProcessingPayment}
          size="lg"
          onPress={handleBook}
          className="w-full mb-8 shadow-premium"
        />
      </ScrollView>

      {/* In-App Razorpay Checkout Modal (Pure In-App Experience) */}
      <RazorpayModal
        visible={razorpayModalVisible}
        checkout={activeRazorpayData}
        onSuccess={handlePaymentSuccess}
        onDismiss={handlePaymentDismiss}
        onError={handlePaymentError}
      />
    </SafeAreaView>
  );
}
