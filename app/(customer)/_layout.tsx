import { Tabs } from 'expo-router';
import FloatingCustomTabBar from '@/components/ui/FloatingCustomTabBar';

export default function CustomerLayout() {
  return (
    <Tabs
      tabBar={(props: any) => <FloatingCustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="wallet/index" options={{ title: 'Book Now' }} />
      <Tabs.Screen name="notifications/index" options={{ title: 'My Orders' }} />
      <Tabs.Screen name="profile/index" options={{ title: 'Profile' }} />

      {/* Hidden Sub-routes */}
      <Tabs.Screen name="profile/addresses" options={{ href: null }} />
      <Tabs.Screen name="profile/invoices" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
    </Tabs>
  );
}
