import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBookingById, cancelBooking } from '@/api/bookings';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

export default function BookingDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Booking Query
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => getBookingById(id),
  });

  const booking = data?.booking;

  // Poll booking status and worker location dynamically
  const getPollingInterval = () => {
    if (!booking) return null;
    switch (booking.status) {
      case BookingStatus.ON_THE_WAY:
        return 8000; // Poll every 8s when worker is en route
      case BookingStatus.PENDING_ASSIGNMENT:
      case BookingStatus.WORKER_ASSIGNED:
      case BookingStatus.WORKER_ACCEPTED:
      case BookingStatus.ARRIVED:
      case BookingStatus.IN_PROGRESS:
        return 12000; // Poll every 12s for active tracking
      default:
        return null;  // Completed or cancelled
    }
  };

  const pollInterval = getPollingInterval();
  const isPolled = pollInterval !== null;

  usePolling(
    async () => {
      await refetch();
    },
    pollInterval,
    isPolled
  );

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(id),
    onSuccess: (res) => {
      if (res.success) {
        showAlert(t('bookings.cancelled') || 'Cancelled', t('bookings.bookingCancelledMsg') || 'Booking cancelled successfully.');
        queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
        queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
      }
    },
    onError: (err: any) => {
      showAlert(t('bookings.reviewError') || 'Error', err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    },
  });

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`${t('bookings.cancelRequest') || 'Cancel Booking'}\n\nAre you sure you want to cancel this booking?`);
      if (confirm) {
        cancelMutation.mutate();
      }
    } else {
      Alert.alert(
        t('bookings.cancelRequest') || 'Cancel Booking',
        'Are you sure you want to cancel this booking?',
        [
          { text: t('common.no') || 'No', style: 'cancel' },
          { text: t('common.yes') || 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
        ]
      );
    }
  };

  const handleCallWorker = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showAlert('Call Failed', 'Unable to initiate call on this device.');
    });
  };

  const handleCopyOtp = (code?: string | null) => {
    if (!code) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } else {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const getStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.COMPLETED:
        return 'success';
      case BookingStatus.CANCELLED:
        return 'error';
      case BookingStatus.PENDING_ASSIGNMENT:
      case BookingStatus.MANUAL_ASSIGNMENT_REQUIRED:
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
        return t('bookings.pending_assignment') || 'Matching Expert';
      case BookingStatus.MANUAL_ASSIGNMENT_REQUIRED:
        return t('bookings.manual_assignment_required') || 'Manual Allocation';
      case BookingStatus.WORKER_ASSIGNED:
        return t('bookings.worker_assigned') || 'Expert Assigned';
      case BookingStatus.WORKER_ACCEPTED:
        return t('bookings.worker_accepted') || 'Booking Confirmed';
      case BookingStatus.ON_THE_WAY:
        return t('bookings.on_the_way') || 'Technician En Route';
      case BookingStatus.ARRIVED:
        return t('bookings.arrived') || 'Technician Arrived';
      case BookingStatus.IN_PROGRESS:
        return t('bookings.in_progress') || 'Service In Progress';
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
      case BookingStatus.PENDING_ASSIGNMENT:
      case BookingStatus.MANUAL_ASSIGNMENT_REQUIRED:
        return 0;
      case BookingStatus.WORKER_ASSIGNED:
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

  if (isError || !booking) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 px-6">
        <Ionicons name="alert-circle-outline" size={54} color="#EF4444" />
        <Text className="text-slate-900 text-lg font-bold mt-4">{t('bookings.bookingNotFound')}</Text>
        <Text className="text-slate-500 text-xs text-center mt-2 mb-6">
          {t('bookings.bookingNotFoundMsg')}
        </Text>
        <Button label={t('bookings.backToBookings') || 'Go Back'} onPress={() => router.back()} />
      </View>
    );
  }

  // Check if cancellation is allowed
  const isCancellable = [
    BookingStatus.PENDING_ASSIGNMENT,
    BookingStatus.WORKER_ASSIGNED,
    BookingStatus.WORKER_ACCEPTED,
    BookingStatus.MANUAL_ASSIGNMENT_REQUIRED,
  ].includes(booking.status);

  // Extract worker details
  const workerFullName = booking.workers?.users?.full_name;
  const workerPhone = booking.workers?.users?.phone;
  const workerLat = (booking as any).workers?.current_lat ?? null;
  const workerLng = (booking as any).workers?.current_lng ?? null;
  const currentStep = getStepIndex(booking.status);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="bg-white border-b border-slate-200/80 px-4 py-3.5 shadow-sm">
        <View className="max-w-md w-full mx-auto flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-full bg-slate-100 justify-center items-center mr-3 active:bg-slate-200"
            >
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
            </TouchableOpacity>
            <View>
              <Text className="text-slate-900 text-base font-extrabold">
                {t('jobs.bookingDetails') || 'Booking Tracking'}
              </Text>
              <Text className="text-slate-400 text-[10px] font-mono">
                #{id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>
          <Badge
            label={getStatusLabel(booking.status)}
            variant={getStatusVariant(booking.status)}
            size="md"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="max-w-md w-full mx-auto">
          {/* Visual Step Progress Tracker */}
          <View className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-premium mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                Live Status Tracker
              </Text>
              <Text className="text-purple-700 text-[11px] font-bold">
                Step {Math.min(currentStep, 4) + 1} of 5
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              {[
                { title: 'Placed', icon: 'cart-outline' },
                { title: 'Assigned', icon: 'person-outline' },
                { title: 'En Route', icon: 'car-outline' },
                { title: 'Arrived', icon: 'location-outline' },
                { title: 'Working', icon: 'hammer-outline' },
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

          {/* DYNAMIC RADAR SEARCHING CARD (When PENDING_ASSIGNMENT) */}
          {booking.status === BookingStatus.PENDING_ASSIGNMENT && (
            <View className="bg-white rounded-3xl p-6 border border-purple-200/80 shadow-premium mb-4 items-center">
              {/* Radar Animation Graphic */}
              <View className="w-20 h-20 rounded-full bg-purple-50 items-center justify-center mb-4 relative">
                <View className="absolute inset-0 rounded-full border-2 border-[#3C01A7]/30" />
                <View className="w-14 h-14 rounded-full bg-purple-100 items-center justify-center">
                  <Ionicons name="search" size={24} color="#3C01A7" />
                </View>
              </View>

              <Text className="text-slate-900 text-base font-extrabold text-center mb-1">
                {t('bookings.findingPartner') || 'Matching Verified Professional...'}
              </Text>
              <Text className="text-slate-500 text-xs text-center leading-4.5 max-w-[280px] mb-3">
                {t('bookings.findingPartnerMsg') || 'Notifying top-rated technicians in your locality. Average match time is under 45 seconds.'}
              </Text>

              <View className="flex-row items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-200">
                <ActivityIndicator size="small" color="#3C01A7" />
                <Text className="text-purple-800 text-[11px] font-semibold">
                  Radar active • Locating experts nearby
                </Text>
              </View>
            </View>
          )}

          {/* STATUS HERO BANNER (When technician is en route / arrived) */}
          {booking.status === BookingStatus.ARRIVED && (
            <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center">
                <Ionicons name="location" size={20} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-900 font-extrabold text-sm">
                  Technician Has Arrived! 📍
                </Text>
                <Text className="text-amber-700 text-xs mt-0.5">
                  Please share the 4-digit PIN below to start your service.
                </Text>
              </View>
            </View>
          )}

          {booking.status === BookingStatus.ON_THE_WAY && (
            <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-blue-500/20 items-center justify-center">
                <Ionicons name="car" size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-blue-900 font-extrabold text-sm">
                  Technician is En Route 🚗
                </Text>
                <Text className="text-blue-700 text-xs mt-0.5">
                  Track live location on the map below.
                </Text>
              </View>
            </View>
          )}

          {booking.status === BookingStatus.IN_PROGRESS && (
            <View className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-purple-500/20 items-center justify-center">
                <Ionicons name="flash" size={20} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-purple-900 font-extrabold text-sm">
                  Work in Progress ⚡
                </Text>
                <Text className="text-purple-700 text-xs mt-0.5">
                  Your technician is completing your service.
                </Text>
              </View>
            </View>
          )}

          {booking.status === BookingStatus.COMPLETED && (
            <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center">
                <Ionicons name="checkmark-circle" size={22} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-emerald-900 font-extrabold text-sm">
                  Service Completed! 🎉
                </Text>
                <Text className="text-emerald-700 text-xs mt-0.5">
                  Thank you for using Volo Home Services.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/(customer)/bookings?openReview=${id}` as any)}
                activeOpacity={0.8}
                className="bg-emerald-600 px-3 py-2 rounded-xl"
              >
                <Text className="text-white text-xs font-bold">Rate</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PROMINENT SECURITY START OTP CARD (When OTP exists & service not completed) */}
          {booking.otp && [
            BookingStatus.WORKER_ACCEPTED,
            BookingStatus.ON_THE_WAY,
            BookingStatus.ARRIVED,
          ].includes(booking.status) && (
            <View className="bg-white rounded-3xl p-5 border-2 border-purple-300 shadow-premium mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center">
                    <Ionicons name="shield-checkmark" size={18} color="#3C01A7" />
                  </View>
                  <View>
                    <Text className="text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                      {t('bookings.verificationCode') || 'Service Start OTP'}
                    </Text>
                    <Text className="text-slate-400 text-[10px]">
                      Share with technician at doorstep
                    </Text>
                  </View>
                </View>

                {/* Copy OTP button */}
                <TouchableOpacity
                  onPress={() => handleCopyOtp(booking.otp)}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-1 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200"
                >
                  <Ionicons name={copiedOtp ? 'checkmark' : 'copy-outline'} size={12} color="#3C01A7" />
                  <Text className="text-[#3C01A7] text-[10px] font-bold">
                    {copiedOtp ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 4 Digit Boxes */}
              <View className="flex-row justify-center gap-3 my-2">
                {booking.otp.split('').map((char: string, idx: number) => (
                  <View
                    key={idx}
                    className="w-13 h-15 rounded-2xl bg-purple-50/70 border border-purple-200 items-center justify-center shadow-sm"
                  >
                    <Text className="text-3xl font-extrabold text-[#3C01A7] font-mono">
                      {char}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="mt-3 bg-amber-50 rounded-xl p-2.5 border border-amber-200/70 flex-row items-center gap-2">
                <Ionicons name="lock-closed" size={14} color="#D97706" />
                <Text className="text-amber-800 text-[11px] font-medium flex-1">
                  🔒 Do not share this OTP over phone. Share only when the professional arrives.
                </Text>
              </View>
            </View>
          )}

          {/* ASSIGNED SERVICE PARTNER CARD */}
          {workerFullName && (
            <View className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-premium mb-4">
              <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-3">
                {t('bookings.yourServicePartner') || 'Assigned Volo Captain'}
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-12 h-12 rounded-2xl bg-purple-100/70 border border-purple-200 items-center justify-center mr-3">
                    <Ionicons name="person" size={22} color="#3C01A7" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-slate-900 text-sm font-extrabold" numberOfLines={1}>
                        Captain {workerFullName}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    </View>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text className="text-slate-700 text-xs font-semibold">4.8</Text>
                      <Text className="text-slate-400 text-[10px]">• Certified Volo Captain</Text>
                    </View>
                  </View>
                </View>

                {/* Call Worker Button */}
                {workerPhone && (
                  <TouchableOpacity
                    onPress={() => handleCallWorker(workerPhone)}
                    activeOpacity={0.8}
                    className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex-row items-center gap-1.5 active:bg-emerald-100"
                  >
                    <Ionicons name="call" size={16} color="#059669" />
                    <Text className="text-emerald-700 text-xs font-bold">Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* LIVE SERVICE MAP (When captain is assigned or en route) */}
          {isPolled && booking.status !== BookingStatus.PENDING_ASSIGNMENT && (
            <View className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-premium mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="map-outline" size={16} color="#3C01A7" />
                  <Text className="text-slate-900 text-xs font-extrabold">
                    {t('bookings.liveServiceMap') || 'Live Captain Tracking'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-700 text-[10px] font-bold">Live GPS</Text>
                </View>
              </View>

              <MapPlaceholder
                workerLat={workerLat}
                workerLng={workerLng}
                destLat={booking.lat}
                destLng={booking.lng}
                workerName={workerFullName ?? t('bookings.yourServicePartner') ?? 'Service Partner'}
                statusText={getStatusLabel(booking.status)}
              />
            </View>
          )}

          {/* BOOKING DETAILS & SUMMARY CARD */}
          <View className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-premium mb-4">
            <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-3">
              {t('bookings.summary') || 'Booking Summary'}
            </Text>

            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="construct-outline" size={15} color="#64748B" />
                <Text className="text-slate-600 text-xs font-medium">{t('jobs.service') || 'Service'}</Text>
              </View>
              <Text className="text-slate-900 text-xs font-bold">
                {booking.service_items?.name ?? 'Home Service'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={15} color="#64748B" />
                <Text className="text-slate-600 text-xs font-medium">{t('bookings.scheduledTime') || 'Booking Time'}</Text>
              </View>
              <Text className="text-slate-800 text-xs font-medium">
                {new Date(booking.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="card-outline" size={15} color="#64748B" />
                <Text className="text-slate-600 text-xs font-medium">{t('bookings.paymentMode') || 'Payment Method'}</Text>
              </View>
              <Text className="text-slate-800 text-xs font-bold uppercase">
                {booking.payment_mode}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2.5 border-b border-slate-100">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cash-outline" size={15} color="#059669" />
                <Text className="text-slate-600 text-xs font-medium">{t('bookings.serviceCharge') || 'Total Amount'}</Text>
              </View>
              <View className="bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                <Text className="text-[#3C01A7] text-xs font-extrabold">₹{booking.total_amount}</Text>
              </View>
            </View>

            {/* Address */}
            <View className="pt-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text className="text-slate-500 text-[11px] font-semibold">
                  {t('jobs.address') || 'Service Delivery Address'}
                </Text>
              </View>
              <Text className="text-slate-800 text-xs font-medium leading-4.5 pl-5">
                {booking.address_line}
              </Text>
            </View>

            {booking.notes ? (
              <View className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                  {t('bookings.specialNotes') || 'Special Instructions'}
                </Text>
                <Text className="text-slate-700 text-xs italic leading-4 font-medium">
                  "{booking.notes}"
                </Text>
              </View>
            ) : null}
          </View>

          {/* Cancel Booking Action */}
          {isCancellable && (
            <TouchableOpacity
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
              activeOpacity={0.8}
              className="w-full h-12 rounded-2xl border border-red-200 bg-red-50/70 items-center justify-center mb-6 active:bg-red-100"
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text className="text-red-600 text-xs font-bold">
                  {t('bookings.cancelRequest') || 'Cancel Booking'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
