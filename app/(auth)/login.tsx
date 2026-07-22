import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneSchema } from '@volo/shared-types';
import { preCheck, pinLogin } from '@/api/auth';
import { useAuthStore } from '@/features/auth/authStore';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';

// Platform-resilient alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Map API error codes to user-friendly messages
const getFriendlyErrorMessage = (err: any): { title: string; message: string } => {
  const code = err?.response?.data?.code || '';
  const status = err?.response?.status;
  const msg = err?.response?.data?.error ?? err?.message ?? '';

  if (status === 401 || code === 'INVALID_PIN' || msg.toLowerCase().includes('invalid pin') || msg.toLowerCase().includes('wrong pin') || msg.toLowerCase().includes('incorrect pin')) {
    return {
      title: 'Incorrect PIN',
      message: msg || 'The PIN you entered is incorrect. Please try again carefully, or use the Forgot PIN option to reset it.',
    };
  }
  if (status === 429 || code === 'TOO_MANY_ATTEMPTS') {
    return {
      title: 'Account Temporarily Locked',
      message: 'Your account has been locked due to multiple incorrect PIN attempts. Please try again in 10 minutes.',
    };
  }
  if (code === 'USER_NOT_FOUND' || status === 404) {
    return {
      title: 'Account Not Found',
      message: 'No account was found with this phone number. Please check the number and try again.',
    };
  }
  if (err?.code === 'ECONNABORTED' || msg.includes('timeout')) {
    return {
      title: 'Connection Timeout',
      message: 'Could not reach the VOLO servers. Please check your internet connection and try again.',
    };
  }
  return {
    title: 'Something Went Wrong',
    message: msg || 'Authentication check failed. Please try again.',
  };
};

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'worker'>('customer');
  const [loading, setLoading] = useState(false);

  // PIN Login Mode states
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');

  const handleActionPress = async () => {
    const digits = phone.replace(/\D/g, '');
    const validation = PhoneSchema.safeParse(digits);
    if (!validation.success) {
      Alert.alert('Invalid Phone', validation.error.issues[0]?.message || 'Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      if (showPinInput) {
        // Submit PIN Login
        if (pin.length < 4) {
          Alert.alert('Invalid PIN', 'Enter a 4-to-6 digit security PIN.');
          setLoading(false);
          return;
        }

        const data = await pinLogin(`+91${digits}`, pin);
        await setAuth(data.token, data.refreshToken, data.user);

        if (data.user.role === 'worker') {
          router.replace('/(worker)/home');
        } else {
          router.replace('/(customer)/home');
        }
      } else {
        // Pre-check flow
        const result = await preCheck(digits);
        if (result.authMethod === 'pin_required') {
          setShowPinInput(true);
        } else {
          // Proceed to standard Firebase OTP verify
          router.push({
            pathname: '/(auth)/otp-verify',
            params: { phone: `+91${digits}`, role },
          });
        }
      }
    } catch (err: any) {
      const { title, message } = getFriendlyErrorMessage(err);
      showAlert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setShowPinInput(false);
    setPin('');
  };

  const isPhoneValid = phone.replace(/\D/g, '').length === 10;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-12 pb-8 justify-between">
            <View>
              {/* Header & Logo Section */}
              <View className="items-center mb-10 mt-4">
                <Image
                  source={require('../../assets/logo.jpeg')}
                  style={{ width: 88, height: 88, borderRadius: 22, resizeMode: 'contain' }}
                  className="mb-5 border border-border-primary shadow-premium"
                />
                <Text className="text-text-primary text-2xl font-extrabold tracking-tight">Welcome to VOLO</Text>
                <Text className="text-text-secondary text-xs mt-1 font-semibold">
                  Professional home services at your doorstep
                </Text>
              </View>

              {/* Role selector */}
              {!showPinInput && (
                <View className="mb-6">
                  <Text className="text-text-secondary text-[10px] mb-2 font-bold uppercase tracking-wider">I want to login as</Text>
                  <View className="flex-row gap-3">
                    {(['customer', 'worker'] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setRole(r)}
                        activeOpacity={0.9}
                        className={`flex-1 py-3.5 rounded-2xl border items-center flex-row justify-center space-x-2 ${
                          role === r
                            ? 'bg-primary border-primary shadow-premium-indigo'
                            : 'bg-background-secondary border-border-secondary'
                        }`}
                      >
                        <Ionicons
                          name={r === 'customer' ? 'home' : 'construct'}
                          size={15}
                          color={role === r ? '#ffffff' : 'rgb(var(--text-secondary))'}
                        />
                        <Text
                          className={`font-bold text-xs uppercase tracking-wide ${
                            role === r ? 'text-white' : 'text-text-secondary'
                          }`}
                        >
                          {r === 'customer' ? 'Customer' : 'Worker'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Phone Input Box */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider">Mobile Number</Text>
                  {showPinInput && (
                    <TouchableOpacity onPress={resetFlow} activeOpacity={0.8} className="flex-row items-center">
                      <Text className="text-primary text-xs font-bold">Use different number</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View className="flex-row items-center bg-background-secondary border border-border-secondary rounded-2xl px-4 h-14 focus-within:border-primary">
                  <Text className="text-text-secondary text-sm font-bold">🇮🇳 +91</Text>
                  <View className="w-px h-5 bg-border-secondary mx-3" />
                  <TextInput
                    className="flex-1 text-text-primary text-sm font-bold h-full"
                    placeholder="Enter 10-digit number"
                    placeholderTextColor="rgb(var(--text-muted))"
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!showPinInput}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              {/* Dynamic PIN Input Row */}
              {showPinInput && (
                <View className="mb-6">
                  <Text className="text-text-secondary text-[10px] mb-2 font-bold uppercase tracking-wider">Security PIN</Text>
                  <View className="flex-row items-center bg-background-secondary border border-border-secondary rounded-2xl px-4 h-14">
                    <Ionicons name="lock-closed" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                    <TextInput
                      className="flex-1 text-text-primary text-sm font-bold h-full"
                      placeholder="Enter security PIN"
                      placeholderTextColor="rgb(var(--text-muted))"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={6}
                      value={pin}
                      onChangeText={setPin}
                    />
                  </View>
                </View>
              )}

              {/* Action Button CTA */}
              <Button
                label={showPinInput ? 'Log In' : 'Continue'}
                variant={role === 'customer' ? 'primary' : 'brand'}
                disabled={loading || !isPhoneValid}
                loading={loading}
                size="lg"
                onPress={handleActionPress}
                className="w-full mt-2"
              />
            </View>

            {/* Terms Footer */}
            <Text className="text-center text-text-muted text-[10px] font-semibold mt-8 leading-5 px-6">
              By continuing, you agree to our{' '}
              <Text className="text-primary font-bold">Terms of Service</Text> and{' '}
              <Text className="text-primary font-bold">Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
