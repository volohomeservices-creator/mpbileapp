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
  StyleSheet,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { PhoneSchema } from '@volo/shared-types';
import { preCheck, pinLogin } from '@/api/auth';
import { useAuthStore } from '@/features/auth/authStore';
import { Ionicons } from '@expo/vector-icons';
import { normalizeIndianPhoneNumber } from '@/utils/phone';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  if (
    code === 'UNAUTHORIZED_ROLE' ||
    status === 403 ||
    msg.toLowerCase().includes('registered as') ||
    msg.toLowerCase().includes('portal')
  ) {
    return {
      title: 'Portal Mismatch',
      message: msg || 'This mobile number is registered for another portal. Please switch tabs above.',
    };
  }

  if (
    status === 401 ||
    code === 'INVALID_PIN' ||
    msg.toLowerCase().includes('invalid pin') ||
    msg.toLowerCase().includes('wrong pin') ||
    msg.toLowerCase().includes('incorrect pin')
  ) {
    return {
      title: 'Incorrect PIN',
      message: msg || 'The PIN you entered is incorrect. Please try again carefully, or use the Forgot PIN option.',
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // PIN Login Mode states
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');

  const handleActionPress = async () => {
    const phoneCheck = normalizeIndianPhoneNumber(phone);
    if (!phoneCheck.isValid) {
      Alert.alert('Invalid Phone', phoneCheck.error || 'Enter a valid 10-digit mobile number.');
      return;
    }

    if (mode === 'register') {
      if (!firstName.trim()) {
        Alert.alert('First Name Required', 'Please enter your first name.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        Alert.alert('Valid Email Required', 'Please enter a valid email address.');
        return;
      }
    }

    setLoading(true);
    try {
      if (showPinInput) {
        if (pin.length < 4) {
          Alert.alert('Invalid PIN', 'Enter a 4-to-6 digit security PIN.');
          setLoading(false);
          return;
        }

        const data = await pinLogin(phoneCheck.e164, pin, role);
        if (data.user.role !== role) {
          const registeredPortal = data.user.role === 'customer' ? 'Customer' : 'Partner';
          showAlert('Portal Mismatch', `This mobile number is registered as a ${registeredPortal}. Please switch to the ${registeredPortal} tab.`);
          if (data.user.role === 'customer' || data.user.role === 'worker') {
            setRole(data.user.role);
          }
          setLoading(false);
          return;
        }

        await setAuth(data.token, data.refreshToken, data.user);

        if (data.user.role === 'worker') {
          if (data.redirectTo === '/worker/kyc' || data.isNewUser) {
            router.replace('/(worker)/kyc' as any);
          } else {
            router.replace('/(worker)/home');
          }
        } else {
          router.replace('/(customer)/home');
        }
      } else {
        try {
          const result = await preCheck(phoneCheck.e164, role);
          if (mode === 'register' && result.isRegistered) {
            Alert.alert(
              'Already Registered',
              'This mobile number is already registered with VOLO. Please switch to Sign In.',
              [{ text: 'Switch to Sign In', onPress: () => setMode('login') }]
            );
            setLoading(false);
            return;
          }

          if (mode === 'login') {
            if (result.authMethod === 'pin_required') {
              setShowPinInput(true);
              return;
            }
            if (result.isRegistered === false) {
              Alert.alert(
                'Account Not Found',
                'No account found with this mobile number. Please register your account.',
                [{ text: 'New Registration', onPress: () => setMode('register') }]
              );
              setLoading(false);
              return;
            }
          }
        } catch (preCheckErr: any) {
          const status = preCheckErr?.response?.status;
          const errData = preCheckErr?.response?.data;
          if (status === 403 && (errData?.error === 'UNAUTHORIZED_ROLE' || errData?.code === 'UNAUTHORIZED_ROLE')) {
            const registeredRole: 'customer' | 'worker' = (errData?.userRole === 'customer' || errData?.userRole === 'worker')
              ? errData.userRole
              : (role === 'customer' ? 'worker' : 'customer');
            const portalName = registeredRole === 'customer' ? 'Customer' : 'Partner';
            showAlert(
              'Portal Mismatch',
              errData?.message || `This mobile number is registered as a ${portalName}. Please switch to the ${portalName} tab.`
            );
            setRole(registeredRole);
            setLoading(false);
            return;
          }
          console.warn('[Login] preCheck failed, proceeding to OTP verification:', preCheckErr);
        }

        router.push({
          pathname: '/(auth)/otp-verify',
          params: {
            phone: phoneCheck.e164,
            role,
            mode,
            firstName: mode === 'register' ? firstName.trim() : undefined,
            lastName: mode === 'register' ? lastName.trim() : undefined,
            email: mode === 'register' ? email.trim().toLowerCase() : undefined,
          },
        });
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

  // Intercept Android hardware back button so users can return to phone number input from PIN mode
  useEffect(() => {
    if (!showPinInput) return;
    const onBackPress = () => {
      resetFlow();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showPinInput]);

  const handleForgotPin = () => {
    const phoneCheck = normalizeIndianPhoneNumber(phone);
    if (!phoneCheck.isValid) {
      showAlert('Phone Required', phoneCheck.error || 'Please enter your 10-digit mobile number first.');
      return;
    }
    router.push({
      pathname: '/(auth)/otp-verify',
      params: { phone: phoneCheck.e164, role, isForgotPin: 'true' },
    });
  };

  const isPhoneValid = phone.replace(/\D/g, '').length === 10;
  const isRegisterValid = mode === 'register' ? (firstName.trim().length > 0 && email.trim().length > 0) : true;
  const isSubmitDisabled = loading || (showPinInput ? pin.length < 4 : (!isPhoneValid || !isRegisterValid));

  return (
    <View style={styles.screenContainer}>
      {/* Top Left Organic Background Wave Decoration */}
      <View style={styles.topWaveContainer} pointerEvents="none">
        <Svg width={260} height={260} viewBox="0 0 260 260">
          <Circle cx="0" cy="0" r="160" fill="#EFE8FC" opacity="0.6" />
          <Circle cx="20" cy="20" r="110" fill="#E4D7FA" opacity="0.45" />
        </Svg>
      </View>

      {/* Bottom Layered Wave Decoration */}
      <View style={styles.bottomWaveContainer} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={160} viewBox={`0 0 ${SCREEN_WIDTH} 160`}>
          <Path
            d={`M0 60 Q ${SCREEN_WIDTH * 0.25} 110, ${SCREEN_WIDTH * 0.5} 80 T ${SCREEN_WIDTH} 40 L ${SCREEN_WIDTH} 160 L 0 160 Z`}
            fill="#F4F0FD"
            opacity="0.9"
          />
          <Path
            d={`M0 90 Q ${SCREEN_WIDTH * 0.3} 50, ${SCREEN_WIDTH * 0.65} 100 T ${SCREEN_WIDTH} 75 L ${SCREEN_WIDTH} 160 L 0 160 Z`}
            fill="#EBE4FB"
            opacity="0.85"
          />
        </Svg>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentCard}>
              {/* Logo */}
              <View style={styles.logoSection}>
                <View style={styles.logoWrapper}>
                  <Image
                    source={require('../../assets/volo logo3.jpeg')}
                    resizeMode="contain"
                    style={styles.logoImage}
                  />
                </View>

                <Text style={styles.headingTitle}>Welcome to VOLO</Text>
                <Text style={styles.headingSubtitle}>
                  Professional home services at your doorstep
                </Text>
              </View>

              {/* Role Selector: I WANT TO LOGIN AS */}
              {!showPinInput && (
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldLabel}>I WANT TO LOGIN AS</Text>
                  <View style={styles.roleRow}>
                    {/* CUSTOMER Button */}
                    <TouchableOpacity
                      onPress={() => setRole('customer')}
                      activeOpacity={0.9}
                      style={[
                        styles.roleButton,
                        role === 'customer' ? styles.roleButtonActive : styles.roleButtonInactive,
                      ]}
                    >
                      <Ionicons
                        name="home"
                        size={17}
                        color={role === 'customer' ? '#FFFFFF' : '#475569'}
                        style={styles.roleIcon}
                      />
                      <Text
                        style={[
                          styles.roleButtonText,
                          role === 'customer' ? styles.roleTextActive : styles.roleTextInactive,
                        ]}
                      >
                        CUSTOMER
                      </Text>
                    </TouchableOpacity>

                    {/* WORKER Button */}
                    <TouchableOpacity
                      onPress={() => setRole('worker')}
                      activeOpacity={0.9}
                      style={[
                        styles.roleButton,
                        role === 'worker' ? styles.roleButtonActive : styles.roleButtonInactive,
                      ]}
                    >
                      <Ionicons
                        name="construct"
                        size={17}
                        color={role === 'worker' ? '#FFFFFF' : '#475569'}
                        style={styles.roleIcon}
                      />
                      <Text
                        style={[
                          styles.roleButtonText,
                          role === 'worker' ? styles.roleTextActive : styles.roleTextInactive,
                        ]}
                      >
                        WORKER
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Mode Selector: Sign In vs New Registration */}
              {!showPinInput && (
                <View style={styles.modeToggleContainer}>
                  <TouchableOpacity
                    onPress={() => setMode('login')}
                    activeOpacity={0.85}
                    style={[
                      styles.modeToggleButton,
                      mode === 'login' ? styles.modeToggleActive : styles.modeToggleInactive,
                    ]}
                  >
                    <Ionicons
                      name="key-outline"
                      size={14}
                      color={mode === 'login' ? '#26007A' : '#64748B'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.modeToggleText,
                        mode === 'login' ? styles.modeToggleTextActive : styles.modeToggleTextInactive,
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setMode('register')}
                    activeOpacity={0.85}
                    style={[
                      styles.modeToggleButton,
                      mode === 'register' ? styles.modeToggleActive : styles.modeToggleInactive,
                    ]}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={14}
                      color={mode === 'register' ? '#26007A' : '#64748B'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.modeToggleText,
                        mode === 'register' ? styles.modeToggleTextActive : styles.modeToggleTextInactive,
                      ]}
                    >
                      New Registration
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Registration Form Fields */}
              {mode === 'register' && !showPinInput && (
                <>
                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>FIRST NAME *</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.pinIconPrefix}>
                        <Ionicons name="person-outline" size={18} color="#26007A" />
                      </View>
                      <View style={styles.inputDivider} />
                      <TextInput
                        style={styles.phoneTextInput}
                        placeholder="e.g. Rahul"
                        placeholderTextColor="#8E84B0"
                        value={firstName}
                        onChangeText={setFirstName}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>LAST NAME</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.pinIconPrefix}>
                        <Ionicons name="person-outline" size={18} color="#26007A" />
                      </View>
                      <View style={styles.inputDivider} />
                      <TextInput
                        style={styles.phoneTextInput}
                        placeholder="e.g. Sharma"
                        placeholderTextColor="#8E84B0"
                        value={lastName}
                        onChangeText={setLastName}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.pinIconPrefix}>
                        <Ionicons name="mail-outline" size={18} color="#26007A" />
                      </View>
                      <View style={styles.inputDivider} />
                      <TextInput
                        style={styles.phoneTextInput}
                        placeholder="name@example.com"
                        placeholderTextColor="#8E84B0"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Mobile Number Input */}
              <View style={styles.fieldSection}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>
                    {mode === 'register' ? 'MOBILE NUMBER (FOR SMS OTP) *' : 'MOBILE NUMBER'}
                  </Text>
                  {showPinInput && (
                    <TouchableOpacity onPress={resetFlow} activeOpacity={0.8}>
                      <Text style={styles.changeNumberText}>Change number</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.flagPrefix}>
                    <Text style={styles.flagText}>🇮🇳 +91</Text>
                  </View>

                  <View style={styles.inputDivider} />

                  <TextInput
                    style={styles.phoneTextInput}
                    placeholder="Enter 10-digit number"
                    placeholderTextColor="#8E84B0"
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!showPinInput}
                    value={phone}
                    onChangeText={setPhone}
                    onSubmitEditing={() => {
                      if (isPhoneValid && !loading && !showPinInput) {
                        handleActionPress();
                      }
                    }}
                    returnKeyType={showPinInput ? 'default' : 'next'}
                  />
                </View>
              </View>

              {/* PIN Input Row (When required) */}
              {showPinInput && (
                <View style={styles.fieldSection}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>SECURITY PIN</Text>
                    <TouchableOpacity onPress={handleForgotPin} activeOpacity={0.8}>
                      <Text style={styles.forgotPinText}>Forgot PIN?</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputContainer}>
                    <View style={styles.pinIconPrefix}>
                      <Ionicons name="lock-closed" size={18} color="#2D008E" />
                    </View>

                    <View style={styles.inputDivider} />

                    <TextInput
                      style={styles.phoneTextInput}
                      placeholder="Enter security PIN"
                      placeholderTextColor="#8E84B0"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={6}
                      autoFocus={true}
                      value={pin}
                      onChangeText={setPin}
                      onSubmitEditing={() => {
                        if (pin.length >= 4 && !loading) {
                          handleActionPress();
                        }
                      }}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              )}

              {/* Continue Button */}
              <TouchableOpacity
                onPress={handleActionPress}
                disabled={isSubmitDisabled}
                activeOpacity={0.88}
                style={[
                  styles.continueButton,
                  isSubmitDisabled ? styles.continueButtonDisabled : styles.continueButtonEnabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                ) : null}
                <Text style={styles.continueButtonText}>
                  {showPinInput
                    ? 'Submit PIN & Log In'
                    : mode === 'register'
                    ? 'Register & Send OTP'
                    : 'Send Login OTP'}
                </Text>
              </TouchableOpacity>

              {/* Forgot PIN fallback */}
              {showPinInput && (
                <TouchableOpacity
                  onPress={handleForgotPin}
                  activeOpacity={0.8}
                  style={styles.smsOtpFallback}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#2D008E" style={{ marginRight: 6 }} />
                  <Text style={styles.smsOtpText}>Verify via SMS OTP</Text>
                </TouchableOpacity>
              )}

              {/* Quick Mode Toggle Link */}
              {!showPinInput && (
                <TouchableOpacity
                  onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                  activeOpacity={0.8}
                  style={styles.switchModeButton}
                >
                  <Text style={styles.switchModeText}>
                    {mode === 'login' ? (
                      <>New to VOLO? <Text style={styles.switchModeHighlight}>Create an account</Text></>
                    ) : (
                      <>Already have an account? <Text style={styles.switchModeHighlight}>Sign in here</Text></>
                    )}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Terms Footer */}
              <View style={styles.footerContainer}>
                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topWaveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  bottomWaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  contentCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  /* Header & Logo */
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 170,
    height: 85,
    borderRadius: 20,
    backgroundColor: '#3500A3',
    shadowColor: '#3500A3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 170,
    height: 85,
    borderRadius: 20,
  },
  headingTitle: {
    fontSize: 27,
    fontWeight: '900',
    color: '#150E38',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  headingSubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#554C75',
    textAlign: 'center',
    marginTop: 6,
  },

  /* Form Fields */
  fieldSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#554C75',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#26007A',
  },
  forgotPinText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#26007A',
  },

  /* Role Selector */
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#26007A',
    shadowColor: '#26007A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  roleButtonInactive: {
    backgroundColor: '#F7FAFD',
    borderWidth: 1.2,
    borderColor: '#E4EAF4',
  },
  roleIcon: {
    marginRight: 8,
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
  roleTextInactive: {
    color: '#475569',
  },

  /* Mode Selector */
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EFFC',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E6E0F5',
  },
  modeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeToggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#26007A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeToggleInactive: {
    backgroundColor: 'transparent',
  },
  modeToggleText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  modeToggleTextActive: {
    color: '#26007A',
    fontWeight: '800',
  },
  modeToggleTextInactive: {
    color: '#64748B',
  },

  /* Switch Mode Link */
  switchModeButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchModeText: {
    fontSize: 12.5,
    color: '#554C75',
    fontWeight: '600',
  },
  switchModeHighlight: {
    color: '#26007A',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  /* Phone Input */
  inputContainer: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DDD6F3',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#26007A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  flagPrefix: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#150E38',
  },
  pinIconPrefix: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#EAE5F8',
  },
  phoneTextInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#150E38',
  },

  /* Continue Button */
  continueButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  continueButtonEnabled: {
    backgroundColor: '#26007A',
    shadowColor: '#26007A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: '#A892EB', // Exact pastel purple from your design
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  smsOtpFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  smsOtpText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#26007A',
  },

  /* Footer */
  footerContainer: {
    marginTop: 32,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  termsText: {
    fontSize: 11,
    color: '#584F75',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  termsLink: {
    color: '#26007A',
    fontWeight: '800',
  },
});
