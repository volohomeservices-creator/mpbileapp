import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking, BookingStatus } from '@volo/shared-types';
import { useLanguage } from '@/hooks/useLanguage';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

interface BookingCardProps {
  booking: Booking;
  onPress: () => void;
  onWriteReview?: () => void;
}

export function BookingCard({ booking, onPress, onWriteReview }: BookingCardProps) {
  const { t } = useLanguage();

  const getStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.COMPLETED:
        return 'success';
      case BookingStatus.CANCELLED:
        return 'error';
      case BookingStatus.PENDING_ASSIGNMENT:
      case BookingStatus.MANUAL_ASSIGNMENT_REQUIRED:
        return 'warning';
      case BookingStatus.WORKER_ASSIGNED:
      case BookingStatus.WORKER_ACCEPTED:
      case BookingStatus.ON_THE_WAY:
      case BookingStatus.ARRIVED:
      case BookingStatus.IN_PROGRESS:
        return 'brand';
      default:
        return 'default';
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

  const serviceName = booking.service_items?.name ?? 'Home Cleaning';
  const price = booking.total_amount;
  const address = booking.address_line;

  const formattedDate = new Date(booking.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  // Safely extract joined review from the backend response (supports both array and object schemas)
  const rawReview = (booking as any).reviews;
  const review = Array.isArray(rawReview) ? (rawReview[0] || null) : (rawReview || null);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className="mb-4">
      <Card variant="default" className="border-border-primary shadow-premium active:border-border-secondary p-5">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-2">
            <Text className="text-text-primary text-base font-extrabold mb-1" numberOfLines={1}>
              {serviceName}
            </Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="time-outline" size={13} color="rgb(var(--text-muted))" />
              <Text className="text-text-secondary text-xs ml-1 font-semibold">
                {formattedDate}
              </Text>
            </View>
          </View>
          <Badge label={getStatusLabel(booking.status)} variant={getStatusVariant(booking.status)} />
        </View>

        <View className="flex-row items-center mb-3">
          <Ionicons name="location-outline" size={14} color="rgb(var(--text-muted))" />
          <Text className="text-text-secondary text-xs ml-1 flex-1 font-medium" numberOfLines={1}>
            {address}
          </Text>
        </View>

        <View className="h-[1px] bg-border-primary my-2" />

        <View className="flex-row justify-between items-center mt-1">
          <View className="flex-row items-center flex-1 mr-2">
            {booking.workers?.users?.full_name ? (
              <>
                <View className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center mr-2">
                  <Ionicons name="person" size={10} color="rgb(var(--primary))" />
                </View>
                <Text className="text-text-secondary text-xs font-bold" numberOfLines={1}>
                  {booking.workers.users.full_name}
                </Text>
              </>
            ) : (
              <Text className="text-text-muted text-xs italic font-medium">{t('bookings.findingWorker')}</Text>
            )}
          </View>
          <Text className="text-text-primary text-base font-extrabold">
            ₹{price}
          </Text>
        </View>

        {/* Display Submitted Customer Review */}
        {review ? (
          <View className="bg-primary/5 border border-primary/10 p-3 rounded-2xl mt-3.5 flex-row items-start">
            <View className="flex-row items-center bg-primary/10 px-1.5 py-0.5 rounded mr-2 flex-shrink-0">
              <Ionicons name="star" size={10} color="rgb(var(--primary))" />
              <Text className="text-primary text-[10px] font-extrabold ml-0.5">{review.rating}</Text>
            </View>
            <Text className="text-text-secondary text-xs flex-1 italic font-medium leading-4" numberOfLines={2}>
              "{review.comment || t('bookings.reviewedWithoutComment')}"
            </Text>
          </View>
        ) : booking.status === BookingStatus.COMPLETED && onWriteReview ? (
          /* Submission call-to-action */
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onWriteReview();
            }}
            className="mt-3.5 bg-primary/10 border border-primary/15 py-1.5 px-3 rounded-xl self-start flex-row items-center active:bg-primary/20"
          >
            <Ionicons name="create-outline" size={13} color="rgb(var(--primary))" className="mr-1.5" />
            <Text className="text-primary text-[10px] font-bold">{t('bookings.writeReview')}</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}
