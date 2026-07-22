import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking, BookingStatus } from '@volo/shared-types';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface JobCardProps {
  job: Booking;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export function JobCard({
  job,
  onPress,
  onAccept,
  onReject,
  showActions = false,
}: JobCardProps) {
  const getStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.COMPLETED:
        return 'success';
      case BookingStatus.CANCELLED:
        return 'error';
      case BookingStatus.WORKER_ASSIGNED:
        return 'warning';
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
    return status.replace(/_/g, ' ').toLowerCase();
  };

  const serviceName = (job as any).service_name || job.service_items?.name || 'Cleaning Job';
  const pay = (job as any).estimated_earnings !== undefined ? (job as any).estimated_earnings : job.total_amount;
  const address = (job as any).locality || job.address_line;

  const rawDate = job.scheduled_at || job.created_at;
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No Date Set';

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
          <Badge label={getStatusLabel(job.status)} variant={getStatusVariant(job.status)} />
        </View>

        <View className="flex-row items-center mb-3">
          <Ionicons name="location-outline" size={14} color="rgb(var(--text-muted))" />
          <Text className="text-text-secondary text-xs ml-1 flex-1 font-medium" numberOfLines={1}>
            {address}
          </Text>
        </View>

        {job.notes ? (
          <View className="bg-background-secondary p-3 rounded-2xl border border-border-primary mb-3">
            <Text className="text-text-secondary text-xs italic font-medium" numberOfLines={2}>
              "{job.notes}"
            </Text>
          </View>
        ) : null}

        <View className="h-[1px] bg-border-primary my-2" />

        <View className="flex-row justify-between items-center mt-1">
          <View className="flex-row items-center">
            <Ionicons name="cash-outline" size={16} color="rgb(var(--primary))" />
            <Text className="text-text-secondary text-xs ml-1.5 font-bold">Earnings</Text>
          </View>
          <Text className="text-text-primary text-base font-extrabold">
            ₹{pay}
          </Text>
        </View>

        {showActions && (job.status === BookingStatus.WORKER_ASSIGNED || job.status === BookingStatus.PENDING_ASSIGNMENT) && (
          <View className="flex-row mt-4 space-x-3">
            {onReject && (
              <Button
                label="Decline"
                variant="outline"
                size="sm"
                onPress={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                className="flex-1"
              />
            )}
            {onAccept && (
              <Button
                label="Accept Job"
                variant="primary"
                size="sm"
                onPress={(e) => {
                  e.stopPropagation();
                  onAccept();
                }}
                className="flex-1"
              />
            )}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}
