import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notification, NotificationType } from '@volo/shared-types';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
}

interface NotificationStyle {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  badgeBg: string;
  label: string;
}

function getNotificationStyle(type: string): NotificationStyle {
  const t = (type || '').toUpperCase();

  if (t === 'KYC_APPROVED' || t.includes('KYC_APPROV')) {
    return {
      icon: 'shield-checkmark',
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      badgeBg: '#D1FAE5',
      label: 'KYC Verified',
    };
  }
  if (t === 'KYC_REJECTED' || t.includes('KYC_REJECT')) {
    return {
      icon: 'shield',
      iconColor: '#E11D48',
      iconBg: '#FFF1F2',
      badgeBg: '#FFE4E6',
      label: 'KYC Review Update',
    };
  }
  if (t.includes('NEW_KYC_SUBMISSION')) {
    return {
      icon: 'document-text',
      iconColor: '#7C3AED',
      iconBg: '#F5F3FF',
      badgeBg: '#EDE9FE',
      label: 'KYC Submitted',
    };
  }
  if (t === 'BOOKING_REQUEST' || t === 'MANUAL_ASSIGNMENT_CREATED') {
    return {
      icon: 'briefcase',
      iconColor: '#3C01A7',
      iconBg: '#F5F3FF',
      badgeBg: '#EDE9FE',
      label: 'New Request',
    };
  }
  if (t === 'BOOKING_ACCEPTED' || t === 'MANUAL_ASSIGNMENT_ACCEPTED') {
    return {
      icon: 'checkmark-circle',
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      badgeBg: '#D1FAE5',
      label: 'Accepted',
    };
  }
  if (t === 'BOOKING_REJECTED' || t === 'MANUAL_ASSIGNMENT_REJECTED' || t === 'MANUAL_ASSIGNMENT_EXPIRED') {
    return {
      icon: 'close-circle',
      iconColor: '#E11D48',
      iconBg: '#FFF1F2',
      badgeBg: '#FFE4E6',
      label: 'Declined',
    };
  }
  if (t === 'WORKER_ARRIVING' || t === 'WORKER_ARRIVED' || t === 'WORKER_NEARBY') {
    return {
      icon: 'navigate',
      iconColor: '#0284C7',
      iconBg: '#F0F9FF',
      badgeBg: '#E0F2FE',
      label: 'Location Alert',
    };
  }
  if (t === 'JOB_STARTED' || t === 'ROUTE_STARTED') {
    return {
      icon: 'play-circle',
      iconColor: '#D97706',
      iconBg: '#FFFBEB',
      badgeBg: '#FEF3C7',
      label: 'In Progress',
    };
  }
  if (t === 'JOB_COMPLETED') {
    return {
      icon: 'ribbon',
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      badgeBg: '#D1FAE5',
      label: 'Job Completed',
    };
  }
  if (t === 'PAYMENT_SUCCESS' || t === 'PAYOUT_PROCESSED') {
    return {
      icon: 'cash',
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      badgeBg: '#D1FAE5',
      label: 'Payment & Payout',
    };
  }
  if (t === 'LOW_WALLET_BALANCE') {
    return {
      icon: 'warning',
      iconColor: '#D97706',
      iconBg: '#FFFBEB',
      badgeBg: '#FEF3C7',
      label: 'Low Balance',
    };
  }

  return {
    icon: 'notifications',
    iconColor: '#3C01A7',
    iconBg: '#F5F3FF',
    badgeBg: '#EDE9FE',
    label: 'Notification',
  };
}

function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';

    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch (e) {
    return '';
  }
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const style = getNotificationStyle(notification.type);
  const timeLabel = formatRelativeTime(notification.created_at);

  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.card,
        notification.is_read ? styles.cardRead : styles.cardUnread,
      ]}
    >
      {!notification.is_read && <View style={styles.unreadStripe} />}

      <View style={styles.row}>
        <View style={[styles.iconWrapper, { backgroundColor: style.iconBg }]}>
          <Ionicons name={style.icon} size={22} color={style.iconColor} />
        </View>

        <View style={styles.bodyContainer}>
          <View style={styles.topRow}>
            <View style={[styles.badge, { backgroundColor: style.badgeBg }]}>
              <Text style={[styles.badgeText, { color: style.iconColor }]}>
                {style.label}
              </Text>
            </View>

            <View style={styles.timeRow}>
              {!notification.is_read && <View style={styles.unreadDot} />}
              <Text style={styles.timeText}>{timeLabel}</Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {notification.title}
          </Text>

          <Text style={styles.body} numberOfLines={3}>
            {notification.body}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: '#E9D5FF',
    backgroundColor: '#FAF8FF',
    shadowColor: '#3C01A7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardRead: {
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  unreadStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#7C3AED',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  bodyContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7C3AED',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    lineHeight: 18,
  },
  body: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 16,
  },
});
