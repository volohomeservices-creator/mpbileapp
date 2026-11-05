import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export interface InAppNotificationPayload {
  title: string;
  body: string;
  type?: string;
  data?: any;
  onPress?: () => void;
}

type NotificationListener = (payload: InAppNotificationPayload | null) => void;
const listeners = new Set<NotificationListener>();

/**
 * Programmatically trigger a floating mobile notification banner
 */
export function displayInAppNotification(payload: InAppNotificationPayload) {
  listeners.forEach((listener) => listener(payload));
}

export function dismissInAppNotification() {
  listeners.forEach((listener) => listener(null));
}

export function InAppNotificationBanner() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<InAppNotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler: NotificationListener = (payload) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      if (payload) {
        setCurrent(payload);
        // Animate in
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 70,
            friction: 9,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // Auto dismiss after 5 seconds
        dismissTimerRef.current = setTimeout(() => {
          hideBanner();
        }, 5000);
      } else {
        hideBanner();
      }
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const hideBanner = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrent(null);
    });
  };

  if (!current) return null;

  const getStyleForType = (type?: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('KYC') || t.includes('APPROV')) {
      return {
        icon: 'shield-checkmark',
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        badge: 'KYC VERIFIED',
      };
    }
    if (t.includes('REJECT')) {
      return {
        icon: 'alert-circle',
        color: '#E11D48',
        bg: '#FFF1F2',
        border: '#FECDD3',
        badge: 'ACTION REQUIRED',
      };
    }
    if (t.includes('JOB') || t.includes('BOOKING')) {
      return {
        icon: 'briefcase',
        color: '#3C01A7',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        badge: 'JOB UPDATE',
      };
    }
    return {
      icon: 'notifications',
      color: '#3C01A7',
      bg: '#F5F3FF',
      border: '#E9D5FF',
      badge: 'VOLO NOTIFICATION',
    };
  };

  const style = getStyleForType(current.type || current.data?.type);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: Math.max(insets.top, 12),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          hideBanner();
          current.onPress?.();
        }}
        style={[styles.card, { borderColor: style.border }]}
      >
        <View style={[styles.iconContainer, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon as any} size={22} color={style.color} />
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: style.bg }]}>
              <Text style={[styles.badgeText, { color: style.color }]}>{style.badge}</Text>
            </View>
            <Text style={styles.timeText}>Just now</Text>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {current.body}
          </Text>
        </View>

        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={hideBanner}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1E1535',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 1,
  },
  body: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 15,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
