import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/hooks/useLanguage';

export default function WorkerLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#ff7a00', // brand worker orange
        tabBarInactiveTintColor: '#94a3b8', // slate-400
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          paddingBottom: Platform.OS === 'ios' ? 24 : (Platform.OS === 'web' ? 12 : 8),
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : (Platform.OS === 'web' ? 72 : 64),
          elevation: 4,
          shadowColor: '#64748b',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('tabs.jobs'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settlements/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wallet/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/availability"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
