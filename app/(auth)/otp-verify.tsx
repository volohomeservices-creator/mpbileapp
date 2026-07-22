import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyFirebaseToken, setPin } from '@/api/auth';
import { useAuthStore } from '@/features/auth/authStore';
import { registerDeviceToken } from '@/api/deviceTokens';
import { OtpSchema } from '@volo/shared-types';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';

// Dynamic loaders to prevent web crash
const getNativeAuth = () => {
  if (Platform.OS === 'web') return null;
  const moduleName = '@react-native-firebase/auth';
  return require(moduleName).default;
};

const getNativeMessaging = () => {
  if (Platform.OS === 'web') return null;
  const moduleName = '@react-native-firebase/messaging';
  return require(moduleName).default;
};

export default function OtpVerifyScreen() {
  const router = useRouter();
  const { phone, role } = useLocalSearchParams<{ phone: string; role: 'customer' | 'worker' }>();
  const { setAuth } = useAuthStore();

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Security PIN Setup State
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [authResponseData, setAuthResponseData] = useState<any>(null);

  // Send OTP via Firebase on mount
  useEffect(() => {
    sendOtp();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = () => {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    setSending(true);
    try {
      if (Platform.OS === 'web') {
        const { sendOtpWeb } = require('@/lib/firebase-web');
        const result = await sendOtpWeb(phone);
        setConfirmation(result);
        startResendTimer();
        return;
      }
      const nativeAuth = getNativeAuth();
      const result = await nativeAuth().signInWithPhoneNumber(phone);
      setConfirmation(result);
      startResendTimer();
    } catch (err: any) {
      Alert.alert('OTP Error', err.message ?? 'Failed to send OTP. Check phone number.');
      router.back();
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    const cleanVal = val.length > 1 ? val.charAt(val.length - 1) : val;
    if (!/^\d?$/.test(cleanVal)) return;

    const next = [...otp];
    next[idx] = cleanVal;
    setOtp(next);

    if (cleanVal && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
    
    if (cleanVal && idx === 5 && next.every(Boolean)) {
      verifyOtp(next.join(''));
    }
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      const next = [...otp];
      next[idx - 1] = '';
      setOtp(next);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const verifyOtp = async (code?: string) => {
    const otpCode = code ?? otp.join('');
    const validation = OtpSchema.safeParse(otpCode);
    if (!validation.success) {
      Alert.alert('Invalid OTP', validation.error.issues[0]?.message || 'Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      // 1. Confirm OTP with Firebase
      const credential = await confirmation.confirm(otpCode);
      const idToken = await credential.user.getIdToken();

      // 2. Exchange Firebase token for VOLO JWT
      const data = await verifyFirebaseToken(idToken, role);

      // 3. Persist auth state
      await setAuth(data.token, data.refreshToken, data.user);
      setAuthResponseData(data);

      // 4. Register FCM token (best-effort)
      try {
        const nativeMessaging = getNativeMessaging();
        if (nativeMessaging) {
          const fcmToken = await nativeMessaging().getToken();
          if (fcmToken) {
            await registerDeviceToken(fcmToken, Platform.OS as 'android' | 'ios');
          }
        }
      } catch (err) {
        console.warn('[FCM] Failed to get/register token during login:', err);
      }

      // 5. Check if security PIN configuration is prompted
      if (data.promptPinSetup) {
        setShowPinSetup(true);
      } else {
        // Direct Route by role
        if (data.user.role === 'worker') {
          router.replace('/(worker)/home');
        } else {
          router.replace('/(customer)/home');
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Verification failed.';
      Alert.alert('Error', msg);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Submit and save new PIN
  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      Alert.alert('Invalid PIN', 'PIN must be between 4 and 6 digits.');
      return;
    }

    setPinLoading(true);
    try {
      await setPin(newPin);
      Alert.alert('PIN Configured', 'Your security PIN has been successfully set.');
      
      // Redirect
      if (authResponseData?.user?.role === 'worker') {
        router.replace('/(worker)/home');
      } else {
        router.replace('/(customer)/home');
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error ?? 'Unable to set security PIN. Please try again.';
      Alert.alert('PIN Configuration Error', errorMsg);
    } finally {
      setPinLoading(false);
    }
  };

  // RENDER PIN SETUP INTERFACE
  if (showPinSetup) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 px-6 pt-12 pb-8 justify-between">
            <View>
              {/* Header */}
              <View className="mb-8 mt-4 items-center">
                <View className="w-14 h-14 rounded-[20px] bg-primary/10 items-center justify-center mb-4 border border-primary/15">
                  <Ionicons name="lock-closed" size={22} color="rgb(var(--primary))" />
                </View>
                <Text className="text-text-primary text-2xl font-extrabold tracking-tight text-center">Create Security PIN</Text>
                <Text className="text-text-secondary text-xs mt-2 font-semibold text-center leading-5 px-6">
                  Set up a 4-to-6 digit security PIN for quick passcode access in the future.
                </Text>
              </View>

              {/* Pin Input Box */}
              <View className="mb-6">
                <Text className="text-text-secondary text-[10px] mb-2.5 font-bold uppercase tracking-wider text-center">New PIN Code</Text>
                <View className="flex-row items-center bg-background-secondary border border-border-secondary rounded-2xl px-4 h-14 w-4/5 mx-auto">
                  <TextInput
                    className="flex-1 text-text-primary text-lg font-mono font-extrabold text-center h-full"
                    placeholder="••••"
                    placeholderTextColor="rgb(var(--text-muted))"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    value={newPin}
                    onChangeText={setNewPin}
                  />
                </View>
              </View>

              {/* Save Button */}
              <Button
                label="Save & Continue"
                variant={role === 'customer' ? 'primary' : 'brand'}
                disabled={pinLoading || newPin.length < 4}
                loading={pinLoading}
                size="lg"
                onPress={handleSavePin}
                className="w-4/5 mx-auto mt-2"
              />
            </View>

            <Text className="text-center text-text-muted text-[10px] font-semibold">
              Your PIN is securely hashed and encrypted.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // RENDER STANDARD OTP INTERFACE
  const isOtpComplete = otp.every(Boolean);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 px-6 pt-12 pb-8 justify-between">
          <View>
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="w-9 h-9 rounded-full bg-background-secondary justify-center items-center mb-6 active:bg-slate-100 border border-border-primary"
            >
              <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
            </TouchableOpacity>

            {/* Header */}
            <Text className="text-text-primary text-2xl font-extrabold mb-1 tracking-tight">Verify OTP</Text>
            <Text className="text-text-secondary text-xs font-semibold mb-8 leading-5">
              We sent a 6-digit verification code to{' '}
              <Text className="text-text-primary font-bold">{phone}</Text>
            </Text>

            {sending ? (
              <View className="items-center py-12">
                <ActivityIndicator color="rgb(var(--primary))" size="large" />
                <Text className="text-text-muted text-[10px] font-bold mt-4 uppercase tracking-wider">Requesting OTP…</Text>
              </View>
            ) : (
              <>
                {/* OTP Boxes */}
                <View className="flex-row justify-between mb-8">
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(r) => { if (r) inputRefs.current[idx] = r; }}
                      className={`w-11 h-14 rounded-2xl border text-center text-text-primary text-lg font-extrabold bg-background-secondary ${
                        digit ? 'border-primary' : 'border-border-secondary'
                      }`}
                      keyboardType="numeric"
                      maxLength={1}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, idx)}
                      onKeyPress={(e) => handleKeyPress(e, idx)}
                      autoFocus={idx === 0}
                    />
                  ))}
                </View>

                {/* Verify Button */}
                <Button
                  label="Verify & Continue"
                  variant={role === 'customer' ? 'primary' : 'brand'}
                  disabled={loading || !isOtpComplete}
                  loading={loading}
                  size="lg"
                  onPress={() => verifyOtp()}
                  className="w-full mb-6"
                />

                {/* Resend Timer */}
                <View className="items-center mt-2">
                  {resendTimer > 0 ? (
                    <Text className="text-text-secondary text-xs font-semibold">
                      Resend OTP in <Text className="text-primary font-extrabold">{resendTimer}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={sendOtp} activeOpacity={0.8} className="active:opacity-60">
                      <Text className="text-primary text-xs font-bold uppercase tracking-wider">Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>

          <Text className="text-center text-text-muted text-[10px] font-semibold">
            Do not share the OTP with anyone.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
