import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If user accessed /cart or /cart/index or /(customer)/cart/index
    if (pathname && pathname.includes('cart')) {
      router.replace('/(customer)/cart');
      return;
    }
    // If user typed literal '(customer)' in the URL
    if (pathname && pathname.includes('(customer)')) {
      router.replace('/(customer)/home');
      return;
    }
  }, [pathname, router]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="compass-outline" size={48} color="#3C01A7" />
      </View>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>
        The page you are looking for doesn't exist or has moved.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(customer)/home')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8F7FC',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0EBFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1535',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E84B0',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#3C01A7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
