import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
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

import {
  getNativeAuth,
  getNativeMessaging,
  isNativeFirebaseDefaultAppReady,
  sendNativePhoneOtp,
} from '@/lib/firebase-native-auth';
import { normalizeIndianPhoneNumber } from '@/utils/phone';

export default function OtpVerifyScreen() {
  const router = useRouter();
  const { phone, role, isForgotPin } = useLocalSearchParams<{ phone: string; role: 'customer' | 'worker'; isForgotPin?: string }>();
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
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    // 1. Validate & normalize Indian phone number to E.164 (+91XXXXXXXXXX)
    const phoneCheck = normalizeIndianPhoneNumber(phone);
    if (!phoneCheck.isValid) {
      Alert.alert('Phone Required', phoneCheck.error || 'Please enter a valid 10-digit mobile number.', [
        { text: 'Back to Login', onPress: () => router.back() }
      ]);
      setSending(false);
      return;
    }

    const e164Phone = phoneCheck.e164;
    setSending(true);
    try {
      if (Platform.OS === 'web') {
        const { sendOtpWeb } = require('@/lib/firebase-web');
        const result = await sendOtpWeb(e164Phone);
        setConfirmation(result);
        startResendTimer();
        return;
      }

      // Check if running inside Expo Go (which does not support native Firebase)
      const Constants = require('expo-constants').default;
      if (Constants.appOwnership === 'expo') {
        throw new Error(
          'SMS OTP verification requires an EAS standalone build or development client. Expo Go does not include native Firebase modules.'
        );
      }

      const result = await sendNativePhoneOtp(e164Phone);
      setConfirmation(result);
      startResendTimer();
    } catch (err: any) {
      const errorCode = String(err?.code || err?.nativeErrorCode || '');
      const rawMessage = String(err?.userInfo?.message || err?.nativeErrorMessage || err?.message || '');

      let userFriendlyMessage = 'Failed to send OTP SMS. Please check your network and phone number.';

      if (
        errorCode.includes('invalid-app-credential') ||
        errorCode.includes('app-not-authorized') ||
        rawMessage.includes('invalid-app-credential') ||
        rawMessage.includes('app-not-authorized')
      ) {
        userFriendlyMessage =
          'App verification failed (Play Integrity/SHA fingerprint not recognized). Please verify that the build SHA fingerprint is registered in Firebase Console.';
      } else if (errorCode.includes('quota-exceeded') || rawMessage.includes('quota')) {
        userFriendlyMessage = 'SMS quota exceeded for today. Please try again later or use PIN login.';
      } else if (errorCode.includes('too-many-requests') || rawMessage.includes('too-many-requests')) {
        userFriendlyMessage = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (errorCode.includes('network-request-failed')) {
        userFriendlyMessage = 'Network connection failed. Please check your internet connection.';
      } else if (errorCode.includes('invalid-phone-number')) {
        userFriendlyMessage = 'The phone number format is invalid. Please check your 10-digit mobile number.';
      } else if (rawMessage) {
        userFriendlyMessage = errorCode ? `[${errorCode}] ${rawMessage}` : rawMessage;
      } else if (errorCode) {
        userFriendlyMessage = `Failed to send OTP SMS [${errorCode}].`;
      }

      console.warn(`[OTP] Send failed for ${phoneCheck.masked}: ${errorCode} - ${rawMessage}`);

      Alert.alert(
        'OTP Error',
        userFriendlyMessage,
        [
          { text: 'Try Again', onPress: () => sendOtp() },
          { text: 'Back to Login', onPress: () => router.back(), style: 'cancel' }
        ]
      );
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
          const fcmToken = await nativeMessaging.getToken();
          if (fcmToken) {
            await registerDeviceToken(fcmToken, Platform.OS as 'android' | 'ios');
          }
        }
      } catch (err) {
        console.warn('[FCM] Failed to get/register token during login:', err);
      }

      // 5. Check if security PIN configuration is prompted or recovering PIN
      if (data.promptPinSetup || isForgotPin === 'true') {
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

  const WEAK_PINS = [
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
    '1234', '4321', '0123', '2345', '3456', '4567', '5678', '6789',
    '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999',
    '123456', '654321',
  ];

  // Submit and save new PIN
  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      Alert.alert('Invalid PIN', 'PIN must be between 4 and 6 numeric digits.');
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'The PIN and Confirm PIN do not match. Please re-enter carefully.');
      return;
    }

    if (WEAK_PINS.includes(newPin)) {
      Alert.alert('Weak PIN', 'This PIN is too common. Please choose a stronger PIN (avoid 1234, 0000, 1111, etc.).');
      return;
    }

    setPinLoading(true);
    try {
      await setPin(newPin);
      
      const successTitle = isForgotPin === 'true' ? 'PIN Reset Complete' : 'PIN Configured';
      const successMsg = isForgotPin === 'true'
        ? 'Your security PIN has been successfully reset. Logging you in now!'
        : 'Your security PIN has been successfully set.';

      if (Platform.OS === 'web') {
        alert(`${successTitle}\n\n${successMsg}`);
      } else {
        Alert.alert(successTitle, successMsg);
      }
      
      // Redirect by role
      const targetRole = authResponseData?.user?.role || role;
      if (targetRole === 'worker') {
        router.replace('/(worker)/home');
      } else {
        router.replace('/(customer)/home');
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error ?? 'Unable to set security PIN. Please try again.';
      if (Platform.OS === 'web') {
        alert(`PIN Configuration Error\n\n${errorMsg}`);
      } else {
        Alert.alert('PIN Configuration Error', errorMsg);
      }
    } finally {
      setPinLoading(false);
    }
  };

  // RENDER PIN SETUP INTERFACE
  if (showPinSetup) {
    const isResetting = isForgotPin === 'true';
    const hasMismatch = confirmPin.length >= 4 && newPin !== confirmPin;
    const isFormValid = newPin.length >= 4 && confirmPin.length >= 4 && newPin === confirmPin;

    return (
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View
              className="flex-1 px-6 pt-8 pb-6 justify-between"
              style={{ maxWidth: 440, width: '100%', alignSelf: 'center' }}
            >
              <View>
                {/* Header */}
                <View className="mb-6 mt-2 items-center">
                  <View className="w-16 h-16 rounded-[22px] bg-purple-50 items-center justify-center mb-4 border border-purple-200 shadow-sm">
                    <Ionicons name="key" size={28} color="#7C3AED" />
                  </View>
                  <Text className="text-text-primary text-2xl font-extrabold tracking-tight text-center">
                    {isResetting ? 'Create New Security PIN' : 'Set Up Security PIN'}
                  </Text>
                  <Text className="text-text-secondary text-xs mt-2 font-semibold text-center leading-5 px-3">
                    {isResetting
                      ? 'Your phone number has been verified via OTP. Please enter and confirm your new 4-to-6 digit PIN.'
                      : 'Set up a 4-to-6 digit security PIN for instant passcode access in the future.'}
                  </Text>
                </View>

                {/* Input 1: New PIN */}
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-text-secondary text-[11px] font-bold uppercase tracking-wider">
                      New Security PIN (4-6 Digits)
                    </Text>
                    <Text className="text-slate-400 text-xs font-semibold">
                      {newPin.length}/6
                    </Text>
                  </View>
                  <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 h-14 w-full focus-within:border-purple-600 focus-within:bg-white">
                    <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      className="flex-1 text-slate-900 text-lg font-mono font-bold h-full tracking-widest"
                      placeholder="Enter new PIN"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      secureTextEntry={!showPassword}
                      maxLength={6}
                      autoFocus={true}
                      value={newPin}
                      onChangeText={setNewPin}
                      returnKeyType="next"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                      className="p-1"
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Input 2: Confirm PIN */}
                <View className="mb-5">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-text-secondary text-[11px] font-bold uppercase tracking-wider">
                      Confirm New PIN
                    </Text>
                    {newPin.length >= 4 && confirmPin.length >= 4 && newPin === confirmPin ? (
                      <View className="flex-row items-center">
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text className="text-emerald-600 text-xs font-bold ml-1">Matches</Text>
                      </View>
                    ) : null}
                  </View>
                  <View className={`flex-row items-center bg-slate-50 border rounded-2xl px-4 h-14 w-full focus-within:bg-white ${
                    hasMismatch ? 'border-red-400' : 'border-slate-200 focus-within:border-purple-600'
                  }`}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={hasMismatch ? '#EF4444' : '#64748B'} style={{ marginRight: 10 }} />
                    <TextInput
                      className="flex-1 text-slate-900 text-lg font-mono font-bold h-full tracking-widest"
                      placeholder="Re-enter new PIN"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      secureTextEntry={!showConfirmPassword}
                      maxLength={6}
                      value={confirmPin}
                      onChangeText={setConfirmPin}
                      onSubmitEditing={() => {
                        if (isFormValid && !pinLoading) {
                          handleSavePin();
                        }
                      }}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      activeOpacity={0.7}
                      className="p-1"
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                  {hasMismatch ? (
                    <Text className="text-red-500 text-xs font-semibold mt-1.5 ml-1">
                      PINs do not match. Please verify your entries.
                    </Text>
                  ) : null}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleSavePin}
                  disabled={pinLoading || !isFormValid}
                  activeOpacity={0.85}
                  className="w-full py-4 rounded-2xl items-center justify-center flex-row mt-2 shadow-sm"
                  style={{
                    backgroundColor: (pinLoading || !isFormValid) ? 'rgba(124, 58, 237, 0.45)' : '#7C3AED',
                  }}
                >
                  {pinLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                  )}
                  <Text className="text-white text-base font-extrabold tracking-wide">
                    {isResetting ? 'Save New PIN & Log In' : 'Set PIN & Continue'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="items-center mt-6">
                <Text className="text-center text-slate-400 text-xs font-medium">
                  🔒 Your PIN is securely encrypted with bcrypt.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // RENDER STANDARD OTP INTERFACE
  const isOtpComplete = otp.every(Boolean);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View
            className="flex-1 px-6 pt-6 pb-6 justify-between"
            style={{ maxWidth: 440, width: '100%', alignSelf: 'center' }}
          >
            <View>
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.8}
                className="w-10 h-10 rounded-full bg-background-secondary justify-center items-center mb-6 active:bg-slate-100 border border-border-primary"
              >
                <Ionicons name="arrow-back" size={20} color="#334155" />
              </TouchableOpacity>

              {/* Header */}
              <Text className="text-text-primary text-2xl font-extrabold mb-1 tracking-tight">Verify OTP</Text>
              <Text className="text-text-secondary text-xs font-semibold mb-8 leading-5">
                We sent a 6-digit verification code to{' '}
                <Text className="text-text-primary font-bold">{phone}</Text>
              </Text>

              {sending ? (
                <View className="items-center py-12">
                  <ActivityIndicator color="#3C01A7" size="large" />
                  <Text className="text-text-muted text-[10px] font-bold mt-4 uppercase tracking-wider">Requesting OTP…</Text>
                </View>
              ) : (
                <>
                  {/* OTP Boxes - Centered and cleanly styled */}
                  <View className="flex-row justify-center gap-2 mb-8">
                    {otp.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        ref={(r) => { if (r) inputRefs.current[idx] = r; }}
                        className={`w-12 h-14 rounded-2xl border text-center text-text-primary text-xl font-black bg-background-secondary ${
                          digit ? 'border-primary' : 'border-border-secondary'
                        }`}
                        style={{
                          width: 48,
                          height: 56,
                          borderColor: digit ? '#3C01A7' : '#CBD5E1',
                          backgroundColor: '#F8FAFC',
                        }}
                        keyboardType="numeric"
                        maxLength={1}
                        value={digit}
                        onChangeText={(v) => handleOtpChange(v, idx)}
                        onKeyPress={(e) => handleKeyPress(e, idx)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </View>

                  {/* Verify Submit Button - Prominently Displayed & High-Contrast */}
                  <TouchableOpacity
                    onPress={() => verifyOtp()}
                    disabled={loading || !isOtpComplete}
                    activeOpacity={0.85}
                    className="w-full py-4 rounded-2xl items-center justify-center flex-row mb-4 shadow-premium"
                    style={{
                      backgroundColor: (loading || !isOtpComplete) ? 'rgba(60, 1, 167, 0.45)' : '#3C01A7',
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text className="text-white text-base font-extrabold tracking-wide">
                      Verify OTP & Continue
                    </Text>
                  </TouchableOpacity>

                  {/* Resend Timer */}
                  <View className="items-center mt-3">
                    {resendTimer > 0 ? (
                      <Text className="text-text-secondary text-xs font-semibold">
                        Resend OTP in <Text className="text-[#3C01A7] font-extrabold">{resendTimer}s</Text>
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={sendOtp} activeOpacity={0.8} className="py-1 px-3">
                        <Text className="text-[#3C01A7] text-xs font-bold uppercase tracking-wider">Resend OTP</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>

            <Text className="text-center text-text-muted text-[10px] font-semibold mt-8">
              Do not share the OTP with anyone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
