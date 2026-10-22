import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, TextInput, Platform, BackHandler, Modal } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getServices, createBooking, getActiveBanners, getInitialCachedCustomerBanners } from '@/api/bookings';
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
import { getFastCurrentLocation } from '@/utils/fastLocation';

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
  const { categoryId, serviceId, checkout, from } = useLocalSearchParams<{ 
    categoryId?: string; 
    serviceId?: string; 
    checkout?: string; 
    from?: string;
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

  const insets = useSafeAreaInsets();

  // UI Flow Step State ('catalog' = browsing services, 'checkout' = configure address, payment, notes)
  const [step, setStep] = useState<'catalog' | 'checkout'>('catalog');

  // Booking details state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
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

  const handleBack = () => {
    if (razorpayModalVisible) {
      setRazorpayModalVisible(false);
      return;
    }
    if (isEditingAddress) {
      setIsEditingAddress(false);
      return;
    }
    // If the screen was launched directly into checkout (from Cart or Home "Book Now")
    if (checkout === 'true') {
      if (from === 'cart' || cartItems.length > 0) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(customer)/cart');
        }
        return;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(customer)/home');
      }
      return;
    }
    // If the user transitioned in-place from the internal catalog step
    if (step === 'checkout') {
      setStep('catalog');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/home');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [step, razorpayModalVisible, isEditingAddress]);

  // Fetch Services catalog with 5-minute cache
  const { data, isLoading } = useQuery({
    queryKey: ['customer-services'],
    queryFn: getServices,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Fetch Saved Addresses with 5-minute cache
  const { data: addressesData } = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: getAddresses,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const savedAddresses = addressesData?.addresses ?? [];

  // Fetch Wallet details with 2-minute cache
  const { data: walletData } = useQuery({
    queryKey: ['customer-wallet'],
    queryFn: getCustomerWallet,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const walletBalance = Number(walletData?.wallet?.balance ?? 0);

  // Fetch live platform payment method availability with 10-minute cache
  const { data: paymentConfig } = useQuery({
    queryKey: ['payment-config'],
    queryFn: () => apiGet<any>('/api/public/payment-config'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Banners Query for dynamic category & catalog hero image support
  const { data: bannersData } = useQuery({
    queryKey: ['customer-active-banners'],
    queryFn: getActiveBanners,
    initialData: getInitialCachedCustomerBanners,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const heroBanner = bannersData?.banners?.find((b: any) => 
    b?.placement === 'CATALOG_HERO' || b?.placement === 'ALL_HERO' || b?.placement === 'CUSTOMER_HERO' || b?.placement === 'HERO' || b?.placement === 'ALL'
  ) || bannersData?.banners?.[0];

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
  
  // Normalize categoryId parameter (handles UUID, slug, name, or banner action_urls)
  const rawParam = typeof categoryId === 'string' ? categoryId.trim() : '';
  const cleanParam = rawParam
    .replace(/^.*[?&]categoryId=/, '')
    .replace(/^.*[?&]category=/, '')
    .replace(/^\/+/, '')
    .toLowerCase();

  // Urban Company-style filter & search state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'price_low' | 'price_high' | 'duration'>('popular');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under_100' | '100_to_500' | 'above_500'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 'quick' | 'standard'>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'sort' | 'price' | 'duration'>('sort');

  useEffect(() => {
    if (cleanParam && cleanParam !== 'all' && cleanParam !== 'customer/services' && cleanParam !== '/') {
      const match = categories.find((c: any) => {
        const catId = (c.id || '').toLowerCase();
        const catName = (c.name || '').toLowerCase();
        const catSlug = (c.slug || '').toLowerCase();
        return catId === cleanParam || catName === cleanParam || (catSlug && catSlug === cleanParam) || catName.includes(cleanParam);
      });
      if (match) {
        setSelectedCategoryFilter(match.id);
      } else {
        setSelectedCategoryFilter('all');
      }
    } else {
      setSelectedCategoryFilter('all');
    }
  }, [cleanParam, categories]);

  const isAllFilter = selectedCategoryFilter === 'all';
  const activeCategory = isAllFilter
    ? { name: 'All Services', id: 'all', items: allItems }
    : (categories.find((c: any) => c.id === selectedCategoryFilter) || (categories.length > 0 ? categories[0] : null));

  // Count active applied modifiers (excluding category)
  const activeFiltersCount = 
    (sortBy !== 'popular' ? 1 : 0) + 
    (priceFilter !== 'all' ? 1 : 0) + 
    (durationFilter !== 'all' ? 1 : 0);

  const resetAllFilters = () => {
    setSortBy('popular');
    setPriceFilter('all');
    setDurationFilter('all');
    setSearchQuery('');
  };

  // Urban Company Multi-Stage Filtering & Sorting Pipeline
  let filteredServices = isAllFilter
    ? allItems
    : (activeCategory?.items ?? allItems.filter((i: any) => i.category_id === selectedCategoryFilter));

  // 1. Search Query filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredServices = filteredServices.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }

  // 2. Price Range filter
  if (priceFilter === 'under_100') {
    filteredServices = filteredServices.filter((s: any) => Number(s.base_price) < 100);
  } else if (priceFilter === '100_to_500') {
    filteredServices = filteredServices.filter((s: any) => Number(s.base_price) >= 100 && Number(s.base_price) <= 500);
  } else if (priceFilter === 'above_500') {
    filteredServices = filteredServices.filter((s: any) => Number(s.base_price) > 500);
  }

  // 3. Duration filter
  if (durationFilter === 'quick') {
    filteredServices = filteredServices.filter((s: any) => Number(s.estimated_mins || 45) <= 45);
  } else if (durationFilter === 'standard') {
    filteredServices = filteredServices.filter((s: any) => Number(s.estimated_mins || 45) > 45);
  }

  // 4. Sort Ordering
  const services = [...filteredServices].sort((a: any, b: any) => {
    if (sortBy === 'price_low') return Number(a.base_price) - Number(b.base_price);
    if (sortBy === 'price_high') return Number(b.base_price) - Number(a.base_price);
    if (sortBy === 'duration') return Number(a.estimated_mins || 45) - Number(b.estimated_mins || 45);
    return 0; // Default popularity
  });

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

  // Auto-fill default saved address if available (instant 0ms)
  useEffect(() => {
    if (savedAddresses.length > 0 && !address) {
      const defaultAddr = savedAddresses.find((a: any) => a.is_default) || savedAddresses[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setAddress(defaultAddr.address);
        if (defaultAddr.latitude && defaultAddr.longitude) {
          setCoords({
            lat: Number(defaultAddr.latitude),
            lng: Number(defaultAddr.longitude),
          });
        }
      }
    }
  }, [savedAddresses]);

  // Fast GPS location resolver using instant cache & timeouts
  const getLocation = async (forceFresh = false) => {
    setLocating(true);
    try {
      const loc = await getFastCurrentLocation({ forceFresh });
      if (loc) {
        setCoords({ lat: loc.latitude, lng: loc.longitude });
        if (loc.formattedAddress) {
          setAddress(loc.formattedAddress);
        } else if (!address) {
          setAddress(`GPS Location (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`);
        }
        setSelectedAddressId(null);
      } else if (!address) {
        showAlert('Location Notice', 'Could not lock GPS immediately. You can select a saved address or type your address manually.');
      }
    } catch (err) {
      console.warn('Location detection notice:', err);
    } finally {
      setLocating(false);
    }
  };

  // Only auto-fetch GPS if user has no saved addresses and no address set
  useEffect(() => {
    if (!address && savedAddresses.length === 0) {
      getLocation(false);
    }
    if (Platform.OS === 'web') {
      loadRazorpayScript().catch(() => {});
    }
  }, []);

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
          {/* Header Image Slider (Dynamic Category Image or Hero Banner) */}
          <View className="relative h-60 bg-[#18073E]">
            {(() => {
              const categoryHeroImg = (activeCategory as any)?.icon_url || (activeCategory as any)?.image_url;
              const heroImageUrl = categoryHeroImg 
                ? getPublicMediaUrl(categoryHeroImg, 'service-images') 
                : (heroBanner?.image_url 
                    ? (getPublicMediaUrl(heroBanner.image_url, 'services') || heroBanner.image_url) 
                    : 'https://ruavhqfttentcjtmnlct.supabase.co/storage/v1/object/public/services/banners/1791618779063_mobile_banner.webp');

              return (
                <>
                  {heroImageUrl ? (
                    <Image
                      source={{ uri: heroImageUrl }}
                      className="w-full h-full opacity-90"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full bg-[#18073E] items-center justify-center">
                      <Ionicons name="sparkles" size={48} color="#A78BFA" />
                    </View>
                  )}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                </>
              );
            })()}

            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.8}
              className="absolute left-6 top-12 w-9 h-9 rounded-full bg-white justify-center items-center shadow-premium border border-border-primary"
            >
              <Ionicons name="arrow-back" size={18} color="#1E1535" />
            </TouchableOpacity>

            {/* Overlay Cart Button */}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(customer)/cart', params: { from: 'catalog' } } as any)}
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
              <Text className="text-text-primary text-xl font-extrabold capitalize">{activeCategory?.name || t('bookings.bookService')}</Text>
              <Badge label={t('bookings.vSafe')} variant="brand" />
            </View>

            <View className="flex-row items-center gap-3 mb-4">
              <View className="flex-row items-center">
                <Ionicons name="star" size={14} color="#FF9F2E" />
                <Text className="text-text-primary text-xs font-bold ml-1">
                  {(activeCategory as any)?.average_rating ?? '4.8'}
                </Text>
                <Text className="text-text-muted text-xs font-medium ml-1">
                  ({(activeCategory as any)?.total_reviews ?? '5'} reviews)
                </Text>
              </View>
              <View className="w-1 h-1 rounded-full bg-border-secondary" />
              <Text className="text-text-secondary text-xs font-medium">
                {(activeCategory as any)?.total_bookings ?? '12'} bookings this week
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

          {/* Urban Company Style Search Bar */}
          <View className="px-5 py-3 bg-white border-b border-border-primary/40">
            <View className="flex-row items-center bg-[#F8F7FC] border border-border-secondary rounded-2xl px-3.5 py-2">
              <Ionicons name="search" size={16} color="#3C01A7" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search services (e.g. repair, switch, tap...)"
                placeholderTextColor="#8E84B0"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-xs font-semibold text-text-primary p-0"
                style={{ height: 22 }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#8E84B0" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Urban Company Style Horizontal Category Filter Bar */}
          <View className="bg-white py-2.5 border-b border-border-primary/40 shadow-xs">
            <View className="px-5 mb-1.5 flex-row justify-between items-center">
              <Text className="text-text-muted text-[10px] font-black uppercase tracking-wider">
                Categories
              </Text>
              <Text className="text-[#3C01A7] text-[10px] font-bold">
                {services.length} {services.length === 1 ? 'service' : 'services'} available
              </Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="px-5 flex-row"
              contentContainerStyle={{ paddingRight: 24 }}
            >
              {/* "All" Filter Tab */}
              <TouchableOpacity
                onPress={() => setSelectedCategoryFilter('all')}
                activeOpacity={0.8}
                className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-[#3C01A7] border-[#3C01A7]'
                    : 'bg-[#F8F7FC] border-border-secondary'
                }`}
              >
                <Ionicons 
                  name="grid" 
                  size={11} 
                  color={selectedCategoryFilter === 'all' ? '#FFFFFF' : '#3C01A7'} 
                  style={{ marginRight: 4 }} 
                />
                <Text className={`text-xs font-black capitalize ${
                  selectedCategoryFilter === 'all' ? 'text-white' : 'text-text-primary'
                }`}>
                  All ({allItems.length})
                </Text>
              </TouchableOpacity>

              {/* Individual Category Filter Tabs */}
              {categories.map((cat: any) => {
                const isSelected = selectedCategoryFilter === cat.id;
                const count = cat.items?.length || 0;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryFilter(cat.id)}
                    activeOpacity={0.8}
                    className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                      isSelected
                        ? 'bg-[#3C01A7] border-[#3C01A7]'
                        : 'bg-[#F8F7FC] border-border-secondary'
                    }`}
                  >
                    <Text className={`text-xs font-black capitalize ${
                      isSelected ? 'text-white' : 'text-text-primary'
                    }`}>
                      {cat.name} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Urban Company Quick Filters & Sort Strip */}
          <View className="bg-white py-2 border-b border-border-primary/60">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-5 flex-row"
              contentContainerStyle={{ paddingRight: 24, alignItems: 'center' }}
            >
              {/* Filter Sheet Modal Opener */}
              <TouchableOpacity
                onPress={() => setIsFilterModalOpen(true)}
                activeOpacity={0.8}
                className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                  activeFiltersCount > 0
                    ? 'bg-[#3C01A7] border-[#3C01A7]'
                    : 'bg-[#F8F7FC] border-border-secondary'
                }`}
              >
                <Ionicons 
                  name="options-outline" 
                  size={13} 
                  color={activeFiltersCount > 0 ? '#FFFFFF' : '#3C01A7'} 
                  style={{ marginRight: 4 }} 
                />
                <Text className={`text-[11px] font-black ${
                  activeFiltersCount > 0 ? 'text-white' : 'text-text-primary'
                }`}>
                  Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                </Text>
              </TouchableOpacity>

              {/* Sort Pill */}
              <TouchableOpacity
                onPress={() => {
                  setActiveFilterTab('sort');
                  setIsFilterModalOpen(true);
                }}
                activeOpacity={0.8}
                className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                  sortBy !== 'popular'
                    ? 'bg-[#3C01A7] border-[#3C01A7]'
                    : 'bg-[#F8F7FC] border-border-secondary'
                }`}
              >
                <Ionicons 
                  name="swap-vertical" 
                  size={12} 
                  color={sortBy !== 'popular' ? '#FFFFFF' : '#64748B'} 
                  style={{ marginRight: 4 }} 
                />
                <Text className={`text-[11px] font-black ${
                  sortBy !== 'popular' ? 'text-white' : 'text-text-primary'
                }`}>
                  {sortBy === 'price_low' 
                    ? 'Price: Low' 
                    : sortBy === 'price_high' 
                    ? 'Price: High' 
                    : sortBy === 'duration' 
                    ? 'Fastest' 
                    : 'Sort'}
                </Text>
                <Ionicons 
                  name="chevron-down" 
                  size={11} 
                  color={sortBy !== 'popular' ? '#FFFFFF' : '#94A3B8'} 
                  style={{ marginLeft: 3 }} 
                />
              </TouchableOpacity>

              {/* Quick Pill: Under ₹100 */}
              <TouchableOpacity
                onPress={() => setPriceFilter(priceFilter === 'under_100' ? 'all' : 'under_100')}
                activeOpacity={0.8}
                className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                  priceFilter === 'under_100'
                    ? 'bg-[#3C01A7] border-[#3C01A7]'
                    : 'bg-[#F8F7FC] border-border-secondary'
                }`}
              >
                <Text className={`text-[11px] font-black ${
                  priceFilter === 'under_100' ? 'text-white' : 'text-text-primary'
                }`}>
                  Under ₹100
                </Text>
              </TouchableOpacity>

              {/* Quick Pill: ₹100 - ₹500 */}
              <TouchableOpacity
                onPress={() => setPriceFilter(priceFilter === '100_to_500' ? 'all' : '100_to_500')}
                activeOpacity={0.8}
                className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                  priceFilter === '100_to_500'
                    ? 'bg-[#3C01A7] border-[#3C01A7]'
                    : 'bg-[#F8F7FC] border-border-secondary'
                }`}
              >
                <Text className={`text-[11px] font-black ${
                  priceFilter === '100_to_500' ? 'text-white' : 'text-text-primary'
                }`}>
                  ₹100 - ₹500
                </Text>
              </TouchableOpacity>

              {/* Quick Pill: Express (<=45m) */}
              <TouchableOpacity
                onPress={() => setDurationFilter(durationFilter === 'quick' ? 'all' : 'quick')}
                activeOpacity={0.8}
                className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center shadow-xs ${
                  durationFilter === 'quick'
                    ? 'bg-[#3C01A7] border-[#3C01A7]'
                    : 'bg-[#F8F7FC] border-border-secondary'
                }`}
              >
                <Ionicons 
                  name="flash" 
                  size={11} 
                  color={durationFilter === 'quick' ? '#FFFFFF' : '#FF9F2E'} 
                  style={{ marginRight: 3 }} 
                />
                <Text className={`text-[11px] font-black ${
                  durationFilter === 'quick' ? 'text-white' : 'text-text-primary'
                }`}>
                  Express (≤45m)
                </Text>
              </TouchableOpacity>

              {/* Clear All Pill (when active) */}
              {(activeFiltersCount > 0 || searchQuery.length > 0) && (
                <TouchableOpacity
                  onPress={resetAllFilters}
                  activeOpacity={0.8}
                  className="mr-2 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 flex-row items-center shadow-xs"
                >
                  <Ionicons name="close-circle" size={12} color="#E11D48" style={{ marginRight: 3 }} />
                  <Text className="text-[11px] font-black text-rose-600">Reset</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* User Guide Tip */}
          <View className="mx-5 my-2.5 p-2.5 bg-[#F4EFFE] rounded-2xl border border-[#3C01A7]/15 flex-row items-center">
            <Ionicons name="information-circle" size={15} color="#3C01A7" style={{ marginRight: 8 }} />
            <Text className="text-[#3C01A7] text-[11px] font-semibold flex-1 leading-4">
              Tap <Text className="font-extrabold">"+ Add"</Text> to place items in cart, or tap card to book directly.
            </Text>
          </View>

          {/* Services 2-Column Grid (Urban Company Style) */}
          <View className="px-4 pb-6 bg-[#F8F7FC] mb-24">
            <View className="flex-row items-center justify-between mb-3 px-1">
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
                  {searchQuery || activeFiltersCount > 0
                    ? `No services match your active filters or search "${searchQuery}".`
                    : 'There are currently no active services listed under this category.'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategoryFilter('all');
                    resetAllFilters();
                  }}
                  activeOpacity={0.85}
                  style={{ backgroundColor: '#3C01A7' }}
                  className="px-5 py-2.5 rounded-xl shadow-xs flex-row items-center"
                >
                  <Text className="text-white text-xs font-black mr-1.5">Reset All Filters</Text>
                  <Ionicons name="refresh" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {services.map((item: any) => {
                  const cartQty = getItemQuantity(item.id);
                  const serviceImg = getPublicMediaUrl(item.icon_url || item.image_url, 'service-images');
                  const cleanDesc = (item.description || '').replace(/^[,\s.-]+/, '').trim();
                  const itemCat = categories.find((c: any) => c.id === item.category_id);
                  const itemCatName = item.category_name || itemCat?.name || (activeCategory?.id !== 'all' ? activeCategory?.name : null);

                  return (
                    <View
                      key={item.id}
                      className="w-[48.5%] mb-3.5 bg-white rounded-2xl border border-border-primary/80 shadow-xs overflow-hidden flex-col justify-between"
                      style={{
                        shadowColor: '#18073E',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 5,
                        elevation: 2,
                      }}
                    >
                      {/* Top: Service Cover Image with Duration Tag */}
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
                              category_name: itemCatName,
                            });
                          }
                          setStep('checkout');
                        }}
                        className="w-full h-28 bg-[#F0EBFB] relative overflow-hidden"
                      >
                        {serviceImg ? (
                          <Image
                            source={{ uri: serviceImg }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center bg-[#F0EBFB]">
                            <Ionicons name="construct-outline" size={28} color="#3C01A7" />
                          </View>
                        )}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.45)']}
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32 }}
                        />
                        <View className="absolute bottom-1.5 left-2 bg-black/60 px-1.5 py-0.5 rounded-md flex-row items-center">
                          <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                          <Text className="text-white text-[9px] font-bold ml-1">
                            {item.estimated_mins || 45}m
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Middle: Category Tag, Title & Brief Description */}
                      <View className="p-2.5 flex-1 justify-between">
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
                                category_name: itemCatName,
                              });
                            }
                            setStep('checkout');
                          }}
                        >
                          {itemCatName ? (
                            <View className="mb-1 self-start">
                              <Text 
                                className="text-[9px] font-black uppercase tracking-wider text-[#3C01A7] bg-[#F0EBFB] px-1.5 py-0.5 rounded-md" 
                                numberOfLines={1}
                              >
                                {itemCatName}
                              </Text>
                            </View>
                          ) : null}
                          <Text className="text-text-primary text-xs font-black leading-tight mb-1" numberOfLines={2}>
                            {item.name}
                          </Text>
                          {cleanDesc ? (
                            <Text className="text-text-muted text-[10px] leading-3 mb-2" numberOfLines={1}>
                              {cleanDesc}
                            </Text>
                          ) : null}
                        </TouchableOpacity>

                        {/* Bottom Row: Price & Add / Stepper */}
                        <View className="pt-2 border-t border-slate-100 flex-row items-center justify-between mt-auto">
                          <Text className="text-[#1E1535] text-sm font-black">
                            ₹{item.base_price}
                          </Text>

                          {cartQty > 0 ? (
                            <View className="flex-row items-center border border-[#3C01A7] bg-[#F0EBFB] rounded-lg px-1.5 py-1">
                              <TouchableOpacity
                                onPress={() => removeItem(item.id)}
                                activeOpacity={0.7}
                                className="w-5 h-5 rounded bg-white justify-center items-center shadow-xs"
                              >
                                <Ionicons name="remove" size={11} color="#3C01A7" />
                              </TouchableOpacity>
                              <Text className="text-[#3C01A7] text-[11px] font-black px-1.5 min-w-[16px] text-center">
                                {cartQty}
                              </Text>
                              <TouchableOpacity
                                onPress={() => addItem({
                                  id: item.id,
                                  name: item.name,
                                  description: item.description,
                                  base_price: Number(item.base_price),
                                  estimated_mins: item.estimated_mins,
                                  category_id: item.category_id,
                                  category_name: itemCatName,
                                })}
                                activeOpacity={0.7}
                                className="w-5 h-5 rounded bg-[#3C01A7] justify-center items-center shadow-xs"
                              >
                                <Ionicons name="add" size={11} color="#FFFFFF" />
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
                                  category_name: itemCatName,
                                });
                              }}
                              activeOpacity={0.8}
                              className="flex-row items-center border border-[#3C01A7] bg-[#F0EBFB] rounded-lg px-2.5 py-1 active:bg-[#3C01A7]/20 shadow-xs"
                            >
                              <Ionicons name="add" size={12} color="#3C01A7" style={{ marginRight: 2 }} />
                              <Text className="text-[#3C01A7] text-[11px] font-black">Add</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Floating bottom checkout bar (Modernized, Safe-Area aware, No text truncation) */}
        {getTotalCount() > 0 ? (
          <View 
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-border-primary px-4 pt-3 flex-row justify-between items-center shadow-premium"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(customer)/cart', params: { from: 'catalog' } } as any)}
              className="flex-1 mr-3"
            >
              <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider">
                {getTotalCount()} {getTotalCount() === 1 ? t('bookings.itemInCart') : t('bookings.itemsInCart')}
              </Text>
              <View className="flex-row items-baseline gap-1.5">
                <Text className="text-[#3C01A7] text-xl font-black">₹{getTotalPrice()}</Text>
                <Text className="text-[#3C01A7] text-[11px] font-extrabold">View Cart ›</Text>
              </View>
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(customer)/cart', params: { from: 'catalog' } } as any)}
                activeOpacity={0.85}
                className="px-3.5 py-2.5 rounded-xl border border-[#3C01A7]/30 bg-[#F0EBFB] flex-row items-center active:bg-[#3C01A7]/15"
              >
                <Ionicons name="cart" size={15} color="#3C01A7" style={{ marginRight: 4 }} />
                <Text className="text-[#3C01A7] text-xs font-black">Cart</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!selectedService && cartItems.length > 0) {
                    setSelectedService(cartItems[0].id);
                  }
                  setStep('checkout');
                }}
                activeOpacity={0.85}
                style={{ backgroundColor: '#3C01A7' }}
                className="px-4 py-2.5 rounded-xl flex-row items-center shadow-md active:bg-[#2A0078]"
              >
                <Text className="text-white text-xs font-black mr-1.5">Checkout</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Urban Company Slide-Up Bottom Sheet Filter & Sort Modal */}
        <Modal
          visible={isFilterModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsFilterModalOpen(false)}
        >
          <View className="flex-1 bg-black/60 justify-end">
            <TouchableOpacity 
              className="flex-1" 
              activeOpacity={1} 
              onPress={() => setIsFilterModalOpen(false)} 
            />
            <View 
              className="bg-white rounded-t-3xl overflow-hidden max-h-[82%]"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              {/* Modal Header */}
              <View className="px-5 py-4 border-b border-border-primary flex-row justify-between items-center bg-white">
                <View className="flex-row items-center">
                  <Ionicons name="options" size={20} color="#3C01A7" style={{ marginRight: 8 }} />
                  <Text className="text-base font-black text-text-primary">Filters & Sorting</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  {activeFiltersCount > 0 && (
                    <TouchableOpacity onPress={resetAllFilters} activeOpacity={0.7}>
                      <Text className="text-xs font-bold text-rose-600">Clear All</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setIsFilterModalOpen(false)}
                    activeOpacity={0.7}
                    className="w-8 h-8 rounded-full bg-background-secondary items-center justify-center border border-border-primary"
                  >
                    <Ionicons name="close" size={18} color="#1E1535" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Urban Company 2-Column Filter Body */}
              <View className="flex-row" style={{ minHeight: 280, maxHeight: 380 }}>
                {/* Left Column: Filter Categories */}
                <View className="w-[36%] bg-[#F8F7FC] border-r border-border-primary py-2">
                  <TouchableOpacity
                    onPress={() => setActiveFilterTab('sort')}
                    className={`px-4 py-3.5 flex-row items-center justify-between border-l-4 ${
                      activeFilterTab === 'sort'
                        ? 'bg-white border-[#3C01A7]'
                        : 'border-transparent'
                    }`}
                  >
                    <Text className={`text-xs ${activeFilterTab === 'sort' ? 'font-black text-[#3C01A7]' : 'font-bold text-text-secondary'}`}>
                      Sort By
                    </Text>
                    {sortBy !== 'popular' && (
                      <View className="w-2 h-2 rounded-full bg-[#3C01A7]" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActiveFilterTab('price')}
                    className={`px-4 py-3.5 flex-row items-center justify-between border-l-4 ${
                      activeFilterTab === 'price'
                        ? 'bg-white border-[#3C01A7]'
                        : 'border-transparent'
                    }`}
                  >
                    <Text className={`text-xs ${activeFilterTab === 'price' ? 'font-black text-[#3C01A7]' : 'font-bold text-text-secondary'}`}>
                      Price
                    </Text>
                    {priceFilter !== 'all' && (
                      <View className="w-2 h-2 rounded-full bg-[#3C01A7]" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActiveFilterTab('duration')}
                    className={`px-4 py-3.5 flex-row items-center justify-between border-l-4 ${
                      activeFilterTab === 'duration'
                        ? 'bg-white border-[#3C01A7]'
                        : 'border-transparent'
                    }`}
                  >
                    <Text className={`text-xs ${activeFilterTab === 'duration' ? 'font-black text-[#3C01A7]' : 'font-bold text-text-secondary'}`}>
                      Duration
                    </Text>
                    {durationFilter !== 'all' && (
                      <View className="w-2 h-2 rounded-full bg-[#3C01A7]" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Right Column: Tab Options */}
                <ScrollView className="flex-1 bg-white px-4 py-3" showsVerticalScrollIndicator={false}>
                  {activeFilterTab === 'sort' && (
                    <View className="py-1">
                      {[
                        { label: 'Recommended / Popular', value: 'popular', desc: 'Highest rated and most booked' },
                        { label: 'Price: Low to High', value: 'price_low', desc: 'Budget friendly first' },
                        { label: 'Price: High to Low', value: 'price_high', desc: 'Premium services first' },
                        { label: 'Fastest Duration', value: 'duration', desc: 'Quickest completion time' },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setSortBy(opt.value as any)}
                          activeOpacity={0.8}
                          className="py-3 border-b border-border-primary/40 flex-row items-center justify-between"
                        >
                          <View className="flex-1 mr-3">
                            <Text className={`text-xs ${sortBy === opt.value ? 'font-black text-[#3C01A7]' : 'font-semibold text-text-primary'}`}>
                              {opt.label}
                            </Text>
                            <Text className="text-[10px] text-text-muted mt-0.5">{opt.desc}</Text>
                          </View>
                          <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                            sortBy === opt.value ? 'border-[#3C01A7] bg-[#3C01A7]' : 'border-slate-300'
                          }`}>
                            {sortBy === opt.value && <View className="w-2 h-2 rounded-full bg-white" />}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {activeFilterTab === 'price' && (
                    <View className="py-1">
                      {[
                        { label: 'All Prices', value: 'all', desc: 'Show all service pricing tiers' },
                        { label: 'Under ₹100', value: 'under_100', desc: 'Affordable quick fixes & inspections' },
                        { label: '₹100 - ₹500', value: '100_to_500', desc: 'Standard installations & repairs' },
                        { label: 'Above ₹500', value: 'above_500', desc: 'Comprehensive package services' },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setPriceFilter(opt.value as any)}
                          activeOpacity={0.8}
                          className="py-3 border-b border-border-primary/40 flex-row items-center justify-between"
                        >
                          <View className="flex-1 mr-3">
                            <Text className={`text-xs ${priceFilter === opt.value ? 'font-black text-[#3C01A7]' : 'font-semibold text-text-primary'}`}>
                              {opt.label}
                            </Text>
                            <Text className="text-[10px] text-text-muted mt-0.5">{opt.desc}</Text>
                          </View>
                          <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                            priceFilter === opt.value ? 'border-[#3C01A7] bg-[#3C01A7]' : 'border-slate-300'
                          }`}>
                            {priceFilter === opt.value && <View className="w-2 h-2 rounded-full bg-white" />}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {activeFilterTab === 'duration' && (
                    <View className="py-1">
                      {[
                        { label: 'All Durations', value: 'all', desc: 'Show all service turnaround times' },
                        { label: 'Express (≤ 45 mins)', value: 'quick', desc: 'Fast, quick-turnaround services' },
                        { label: 'Standard (> 45 mins)', value: 'standard', desc: 'Detailed, comprehensive sessions' },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setDurationFilter(opt.value as any)}
                          activeOpacity={0.8}
                          className="py-3 border-b border-border-primary/40 flex-row items-center justify-between"
                        >
                          <View className="flex-1 mr-3">
                            <Text className={`text-xs ${durationFilter === opt.value ? 'font-black text-[#3C01A7]' : 'font-semibold text-text-primary'}`}>
                              {opt.label}
                            </Text>
                            <Text className="text-[10px] text-text-muted mt-0.5">{opt.desc}</Text>
                          </View>
                          <View className={`w-5 h-5 rounded-full border items-center justify-center ${
                            durationFilter === opt.value ? 'border-[#3C01A7] bg-[#3C01A7]' : 'border-slate-300'
                          }`}>
                            {durationFilter === opt.value && <View className="w-2 h-2 rounded-full bg-white" />}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>

              {/* Bottom Action Footer */}
              <View className="px-5 py-3 border-t border-border-primary flex-row items-center justify-between bg-white">
                <TouchableOpacity
                  onPress={resetAllFilters}
                  activeOpacity={0.7}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 mr-3"
                >
                  <Text className="text-xs font-bold text-text-secondary">Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsFilterModalOpen(false)}
                  activeOpacity={0.85}
                  style={{ backgroundColor: '#3C01A7' }}
                  className="flex-1 py-3 rounded-xl items-center justify-center shadow-md active:bg-[#2A0078]"
                >
                  <Text className="text-white text-xs font-black">
                    Apply Filters ({services.length} {services.length === 1 ? 'service' : 'services'})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
          onPress={handleBack}
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
              <View className="flex-row justify-between items-center mb-2.5">
                <Text className="text-text-primary text-xs font-black uppercase tracking-wider">
                  Service Details ({cartItems.length})
                </Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(customer)/cart', params: { from: 'checkout' } } as any)}
                  activeOpacity={0.7}
                  className="flex-row items-center bg-white border border-[#3C01A7]/30 px-2.5 py-1 rounded-xl shadow-xs"
                >
                  <Ionicons name="create-outline" size={13} color="#3C01A7" style={{ marginRight: 4 }} />
                  <Text className="text-[#3C01A7] text-[11px] font-black">Edit Cart</Text>
                </TouchableOpacity>
              </View>
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
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-6 h-6 rounded-lg bg-[#F0EBFB] items-center justify-center mr-2">
                  <Ionicons name="location" size={14} color="#3C01A7" />
                </View>
                <Text className="text-text-primary text-xs font-black uppercase tracking-wider flex-shrink" numberOfLines={1}>
                  2. Delivery Address
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditingAddress(!isEditingAddress)}
                activeOpacity={0.8}
                className="bg-[#F0EBFB] px-3 py-1 rounded-xl border border-[#3C01A7]/30"
              >
                <Text className="text-[#3C01A7] text-[11px] font-black">
                  {isEditingAddress ? 'Done' : 'Edit Address'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingAddress ? (
              <TextInput
                value={address}
                onChangeText={(val) => {
                  setAddress(val);
                  setSelectedAddressId(null);
                }}
                className="bg-white border border-[#3C01A7] rounded-xl p-3 text-text-primary text-xs h-20 shadow-xs"
                multiline
                placeholder="Door/Flat no, Street, Landmark, City..."
                placeholderTextColor="#8E84B0"
              />
            ) : (
              <View className="bg-background-secondary p-3.5 rounded-2xl border border-border-secondary">
                <Text className="text-text-primary text-xs font-bold leading-5">
                  {address || 'Awaiting location input...'}
                </Text>
              </View>
            )}

            {/* GPS Lock status */}
            {coords ? (
              <View className="flex-row items-center mt-2 px-1">
                <Ionicons name="navigate-circle" size={12} color="#10B981" style={{ marginRight: 4 }} />
                <Text className="text-text-muted text-[10px] font-mono">
                  GPS Lock: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </Text>
              </View>
            ) : locating ? (
              <View className="flex-row items-center mt-2 px-1">
                <ActivityIndicator size="small" color="#FF9F2E" style={{ marginRight: 6 }} />
                <Text className="text-warning text-[10px] font-bold">Acquiring live coordinates...</Text>
              </View>
            ) : null}

            {/* Saved Addresses chips (Instant 1-tap select) */}
            {savedAddresses.length > 0 && (
              <View className="mt-3.5 pt-3 border-t border-border-primary/60">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-text-muted text-[10px] font-black uppercase tracking-wider">
                    Saved Addresses ({savedAddresses.length})
                  </Text>
                  <Text className="text-text-muted text-[9px] font-bold">Tap to select</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                  {savedAddresses.map((addr: any) => {
                    const isSelected = selectedAddressId === addr.id || address.trim() === addr.address?.trim();
                    const iconName = addr.label?.toLowerCase() === 'home' 
                      ? 'home' 
                      : addr.label?.toLowerCase() === 'work' 
                      ? 'business' 
                      : 'location';

                    return (
                      <TouchableOpacity
                        key={addr.id}
                        onPress={() => {
                          setSelectedAddressId(addr.id);
                          setAddress(addr.address);
                          if (addr.latitude && addr.longitude) {
                            setCoords({ lat: Number(addr.latitude), lng: Number(addr.longitude) });
                          }
                        }}
                        activeOpacity={0.85}
                        className={`mr-2.5 px-3.5 py-2 rounded-xl border flex-row items-center shadow-xs active:scale-95 ${
                          isSelected 
                            ? 'bg-[#3C01A7] border-[#3C01A7]' 
                            : 'bg-white border-border-secondary'
                        }`}
                      >
                        <Ionicons 
                          name={isSelected ? 'checkmark-circle' : iconName as any} 
                          size={13} 
                          color={isSelected ? '#FFFFFF' : '#3C01A7'} 
                          style={{ marginRight: 5 }}
                        />
                        <Text className={`text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-text-primary'}`}>
                          {addr.label || 'Saved'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Live GPS Re-detect button */}
            <TouchableOpacity
              onPress={() => getLocation(true)}
              disabled={locating}
              activeOpacity={0.8}
              className="mt-3.5 py-2.5 rounded-xl bg-[#F0EBFB] border border-[#3C01A7]/30 flex-row items-center justify-center active:bg-[#3C01A7]/20"
            >
              {locating ? (
                <>
                  <ActivityIndicator size="small" color="#3C01A7" style={{ marginRight: 6 }} />
                  <Text className="text-[#3C01A7] text-xs font-black">Acquiring GPS...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="locate" size={15} color="#3C01A7" style={{ marginRight: 6 }} />
                  <Text className="text-[#3C01A7] text-xs font-black">Use Current GPS Location</Text>
                </>
              )}
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
