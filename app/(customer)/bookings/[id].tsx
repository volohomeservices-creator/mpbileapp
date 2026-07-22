import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBookingById, cancelBooking } from '@/api/bookings';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
        return 10000; // Poll every 10s when worker is en route
      case BookingStatus.PENDING_ASSIGNMENT:
      case BookingStatus.WORKER_ASSIGNED:
      case BookingStatus.WORKER_ACCEPTED:
      case BookingStatus.ARRIVED:
      case BookingStatus.IN_PROGRESS:
        return 20000; // Poll every 20s for general updates
      default:
        return null;  // Disable polling entirely when completed or cancelled
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
        showAlert(t('bookings.cancelled'), t('bookings.bookingCancelledMsg'));
        queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
        queryClient.invalidateQueries({ queryKey: ['active-bookings'] });
      }
    },
    onError: (err: any) => {
      showAlert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    },
  });

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`${t('bookings.cancelRequest')}\n\nAre you sure?`);
      if (confirm) {
        cancelMutation.mutate();
      }
    } else {
      Alert.alert(t('bookings.cancelRequest'), t('bookings.cancelRequest') + '?', [
        { text: t('common.no'), style: 'cancel' },
        { text: t('common.yes'), style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]);
    }
  };

  const handleCallWorker = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showAlert('Call Failed', 'Unable to initiate call on this device.');
    });
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
        <ActivityIndicator size="large" color="rgb(var(--primary))" />
        <Text className="text-text-secondary text-xs mt-2 font-semibold">{t('common.loading')}</Text>
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Ionicons name="alert-circle-outline" size={48} color="rgb(var(--danger))" />
        <Text className="text-text-primary text-lg font-bold mt-4">{t('bookings.bookingNotFound')}</Text>
        <Text className="text-text-secondary text-xs text-center mt-2 mb-6">
          {t('bookings.bookingNotFoundMsg')}
        </Text>
        <Button label={t('bookings.backToBookings')} onPress={() => router.back()} />
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

  // Extract worker fields safely (backend nested query)
  const workerFullName = booking.workers?.users?.full_name;
  const workerPhone = booking.workers?.users?.phone;

  // Retrieve locations safely
  const workerLat = (booking as any).workers?.current_lat ?? null;
  const workerLng = (booking as any).workers?.current_lng ?? null;

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white shadow-sm">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} className="mr-4">
          <Ionicons name="arrow-back" size={22} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold flex-1" numberOfLines={1}>
          {t('jobs.bookingDetails')}
        </Text>
        <Badge
          label={getStatusLabel(booking.status)}
          variant={getStatusVariant(booking.status)}
        />
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Tracking Map View if active */}
        {isPolled && booking.status !== BookingStatus.PENDING_ASSIGNMENT ? (
          <View className="mb-6">
            <Text className="text-text-primary text-sm font-extrabold mb-3">{t('bookings.liveServiceMap')}</Text>
            <MapPlaceholder
              workerLat={workerLat}
              workerLng={workerLng}
              destLat={booking.lat}
              destLng={booking.lng}
              workerName={workerFullName ?? t('bookings.yourServicePartner')}
              statusText={getStatusLabel(booking.status)}
            />
          </View>
        ) : booking.status === BookingStatus.PENDING_ASSIGNMENT ? (
          <View className="mb-6">
            <Card variant="brand" className="p-6 items-center">
              <ActivityIndicator size="large" color="rgb(var(--primary))" className="mb-4" />
              <Text className="text-primary text-base font-extrabold text-center mb-1">
                {t('bookings.findingPartner')}
              </Text>
              <Text className="text-text-secondary text-xs text-center leading-4.5 max-w-[260px]">
                {t('bookings.findingPartnerMsg')}
              </Text>
            </Card>
          </View>
        ) : null}

        {/* Worker Details Card if assigned */}
        {workerFullName ? (
          <View className="mb-6">
            <Card variant="default" className="p-5">
              <Text className="text-text-muted text-[10px] font-extrabold uppercase tracking-wider mb-3">
                {t('bookings.yourServicePartner')}
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center mr-3 border border-primary/20">
                    <Ionicons name="person" size={20} color="rgb(var(--primary))" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-primary text-sm font-extrabold" numberOfLines={1}>
                      {workerFullName}
                    </Text>
                    <Text className="text-text-secondary text-xs mt-0.5">{t('bookings.rating')}: 4.8★</Text>
                  </View>
                </View>
                {workerPhone ? (
                  <TouchableOpacity
                    onPress={() => handleCallWorker(workerPhone)}
                    activeOpacity={0.8}
                    className="w-10 h-10 rounded-xl bg-success/10 justify-center items-center active:bg-success/20 border border-success/20"
                  >
                    <Ionicons name="call" size={18} color="rgb(var(--success))" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Booking PIN Code Card */}
        {booking.otp && [
          BookingStatus.WORKER_ACCEPTED,
          BookingStatus.ON_THE_WAY,
          BookingStatus.ARRIVED
        ].includes(booking.status) ? (
          <View className="mb-6">
            <Card variant="brand" className="p-5 items-center">
              <Text className="text-primary text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
                {t('bookings.verificationCode')}
              </Text>
              <Text className="text-primary text-3xl font-extrabold tracking-widest">{booking.otp}</Text>
              <Text className="text-text-secondary text-[10px] text-center mt-2.5">
                {t('bookings.sharePinMsg')}
              </Text>
            </Card>
          </View>
        ) : null}

        {/* Job Details Card */}
        <View className="mb-6">
          <Card variant="default" className="p-5">
            <Text className="text-text-muted text-[10px] font-extrabold uppercase tracking-wider mb-4">
              {t('bookings.summary')}
            </Text>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('jobs.service')}</Text>
              <Text className="text-text-primary text-xs font-bold">{booking.service_items?.name ?? 'Clean'}</Text>
            </View>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('bookings.scheduledTime')}</Text>
              <Text className="text-text-primary text-xs font-bold">
                {new Date(booking.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('bookings.paymentMode')}</Text>
              <Text className="text-text-primary text-xs font-bold">{booking.payment_mode}</Text>
            </View>

            <View className="flex-row justify-between mb-3.5">
              <Text className="text-text-secondary text-xs">{t('bookings.serviceCharge')}</Text>
              <Text className="text-primary text-xs font-extrabold">₹{booking.total_amount}</Text>
            </View>

            <View className="h-[1px] bg-border-primary my-3" />

            <View className="mb-2">
              <Text className="text-text-secondary text-xs mb-1.5">{t('jobs.address')}</Text>
              <Text className="text-text-primary text-xs leading-4.5">{booking.address_line}</Text>
            </View>

            {booking.notes ? (
              <View className="mt-3">
                <Text className="text-text-secondary text-xs mb-1.5">{t('bookings.specialNotes')}</Text>
                <Text className="text-text-secondary text-xs italic leading-4.5 font-medium">"{booking.notes}"</Text>
              </View>
            ) : null}
          </Card>
        </View>

        {/* Action Button */}
        {isCancellable ? (
          <Button
            label={cancelMutation.isPending ? t('bookings.cancellingRequest') : t('bookings.cancelRequest')}
            variant="danger"
            onPress={handleCancel}
            loading={cancelMutation.isPending}
            className="mb-12 w-full"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
