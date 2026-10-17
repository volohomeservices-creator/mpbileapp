import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, LayoutAnimation, UIManager } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Exactly 4 primary worker navigation tabs
const WORKER_ALLOWED_TABS = ['home', 'jobs', 'wallet/index', 'profile/index'];

export default function WorkerFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Hide floating tab bar on job active execution, tracking, and detail screens
  const currentRoute = state.routes[state.index];
  const nestedState = (currentRoute as any)?.state;
  const nestedRouteName = nestedState?.routes?.[nestedState?.index]?.name;
  if (
    nestedRouteName === '[id]' ||
    pathname.includes('/jobs/') ||
    pathname.includes('/profile/availability') ||
    pathname.includes('/settlements')
  ) {
    return null;
  }

  // Filter to only the 4 allowed primary worker tabs
  const visibleRoutes = state.routes.filter(route => WORKER_ALLOWED_TABS.includes(route.name));

  const getTabInfo = (routeName: string) => {
    switch (routeName) {
      case 'home':
        return { label: 'Home', iconActive: 'home', iconInactive: 'home-outline' };
      case 'jobs':
        return { label: 'Jobs', iconActive: 'briefcase', iconInactive: 'briefcase-outline' };
      case 'wallet/index':
        return { label: 'Wallet', iconActive: 'wallet', iconInactive: 'wallet-outline' };
      case 'profile/index':
        return { label: 'Captain', iconActive: 'person', iconInactive: 'person-outline' };
      default:
        return { label: 'Tab', iconActive: 'ellipse', iconInactive: 'ellipse-outline' };
    }
  };

  const triggerSmoothAppleAnimation = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext({
        duration: 300,
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pillBar}>
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index].key === route.key;
          const { label, iconActive, iconInactive } = getTabInfo(route.name);

          const onPress = () => {
            triggerSmoothAppleAnimation();

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.85}
              onPress={onPress}
              style={[
                styles.tabItem,
                isFocused && styles.activeTabPill
              ]}
            >
              <View style={[styles.iconWrapper, isFocused && styles.activeIconCircle]}>
                <Ionicons
                  name={(isFocused ? iconActive : iconInactive) as any}
                  size={18}
                  color={isFocused ? '#3C01A7' : '#D8CEF6'}
                />
              </View>

              {isFocused && (
                <Text style={styles.activeLabelText} numberOfLines={1}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 999,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3C01A7', // Brand Deep Purple Pill
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#3C01A7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: '#561AD6',
    ...(Platform.OS === 'web' && {
      transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }),
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 24,
    ...(Platform.OS === 'web' && {
      transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }),
  },
  activeTabPill: {
    backgroundColor: '#FFFFFF', // Solid White Active Tab Expansion
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0EBFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  activeLabelText: {
    color: '#3C01A7', // Brand Purple Label Text
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
