import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification, NotificationType } from '@volo/shared-types';
import { Card } from './ui/Card';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
}

interface NotificationStyle {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
}

function getNotificationStyle(type: NotificationType): NotificationStyle {
  switch (type) {
    case NotificationType.BOOKING_REQUEST:
    case NotificationType.MANUAL_ASSIGNMENT_CREATED:
      return { icon: 'briefcase', iconColor: 'rgb(var(--primary))', iconBg: 'rgba(var(--primary) / 0.1)', label: 'New Request' };
    case NotificationType.BOOKING_ACCEPTED:
    case NotificationType.MANUAL_ASSIGNMENT_ACCEPTED:
      return { icon: 'checkmark-circle', iconColor: 'rgb(var(--success))', iconBg: 'rgba(var(--success) / 0.1)', label: 'Accepted' };
    case NotificationType.BOOKING_REJECTED:
    case NotificationType.MANUAL_ASSIGNMENT_REJECTED:
    case NotificationType.MANUAL_ASSIGNMENT_EXPIRED:
      return { icon: 'close-circle', iconColor: 'rgb(var(--danger))', iconBg: 'rgba(var(--danger) / 0.1)', label: 'Declined' };
    case NotificationType.WORKER_ARRIVING:
      return { icon: 'car', iconColor: 'rgb(var(--info))', iconBg: 'rgba(var(--info) / 0.1)', label: 'On The Way' };
    case NotificationType.WORKER_ARRIVED:
      return { icon: 'location', iconColor: 'rgb(var(--info))', iconBg: 'rgba(var(--info) / 0.1)', label: 'Arrived' };
    case NotificationType.WORKER_NEARBY:
      return { icon: 'navigate', iconColor: 'rgb(var(--info))', iconBg: 'rgba(var(--info) / 0.1)', label: 'Nearby' };
    case NotificationType.JOB_STARTED:
    case NotificationType.ROUTE_STARTED:
      return { icon: 'play-circle', iconColor: 'rgb(var(--warning))', iconBg: 'rgba(var(--warning) / 0.1)', label: 'In Progress' };
    case NotificationType.JOB_COMPLETED:
      return { icon: 'ribbon', iconColor: 'rgb(var(--success))', iconBg: 'rgba(var(--success) / 0.1)', label: 'Completed' };
    case NotificationType.PAYMENT_SUCCESS:
      return { icon: 'card', iconColor: 'rgb(var(--success))', iconBg: 'rgba(var(--success) / 0.1)', label: 'Paid' };
    case NotificationType.PAYOUT_PROCESSED:
      return { icon: 'cash', iconColor: 'rgb(var(--success))', iconBg: 'rgba(var(--success) / 0.1)', label: 'Payout' };
    case NotificationType.KYC_APPROVED:
      return { icon: 'shield-checkmark', iconColor: 'rgb(var(--success))', iconBg: 'rgba(var(--success) / 0.1)', label: 'KYC Verified' };
    case NotificationType.KYC_REJECTED:
      return { icon: 'shield', iconColor: 'rgb(var(--danger))', iconBg: 'rgba(var(--danger) / 0.1)', label: 'KYC Rejected' };
    case NotificationType.LOW_WALLET_BALANCE:
      return { icon: 'warning', iconColor: 'rgb(var(--warning))', iconBg: 'rgba(var(--warning) / 0.1)', label: 'Low Balance' };
    default:
      return { icon: 'notifications', iconColor: 'rgb(var(--primary))', iconBg: 'rgba(var(--primary) / 0.1)', label: 'System Alert' };
  }
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const style = getNotificationStyle(notification.type);

  const timeLabel = new Date(notification.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.9} className="mb-3">
      <Card 
        variant={notification.is_read ? 'muted' : 'default'} 
        className={`p-4 relative overflow-hidden border ${
          notification.is_read ? 'border-border-primary' : 'border-border-secondary'
        }`}
      >
        {!notification.is_read && (
          <View className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-3xl" />
        )}
        <View className="flex-row items-start">
          <View 
            style={{ backgroundColor: style.iconBg }} 
            className="w-11 h-11 rounded-2xl items-center justify-center mr-3 flex-shrink-0"
          >
            <Ionicons name={style.icon as any} size={20} color={style.iconColor} />
          </View>
          <View className="flex-1">
            <View className="flex-row justify-between items-center mb-1">
              <View 
                style={{ backgroundColor: `${style.iconColor}15` }} 
                className="px-2 py-0.5 rounded-md"
              >
                <Text style={{ color: style.iconColor }} className="text-[9px] font-extrabold uppercase tracking-wide">
                  {style.label}
                </Text>
              </View>
              {!notification.is_read && (
                <View className="w-2 h-2 rounded-full bg-primary" />
              )}
            </View>
            <Text className="text-text-primary text-sm font-extrabold mb-1 leading-5" numberOfLines={1}>
              {notification.title}
            </Text>
            <Text className="text-text-secondary text-xs leading-4.5 mb-2" numberOfLines={2}>
              {notification.body}
            </Text>
            <Text className="text-text-muted text-[10px] font-bold">{timeLabel}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
