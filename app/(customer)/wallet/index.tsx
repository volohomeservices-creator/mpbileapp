import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform, Modal, TextInput, BackHandler } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCustomerWallet, createCustomerWalletTopUpOrder, verifyCustomerWalletTopUp } from '@/api/wallet';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDateTime } from '@/utils/formatDate';
import { useLanguage } from '@/hooks/useLanguage';
import { RazorpayModal, RazorpayPaymentData, RazorpaySuccessResponse } from '@/components/RazorpayModal';

function loadRazorpayScript(): Promise<void> {
  if (Platform.OS !== 'web') {
    return Promise.resolve();
  }
  if (typeof window !== 'undefined' && (window as any).Razorpay) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }
    const existing = document.getElementById('razorpay-checkout-js') as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).Razorpay) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay script.')));
      setTimeout(() => resolve(), 600);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay script.'));
    document.body.appendChild(script);
  });
}

export default function CustomerWalletScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['customer-wallet'],
    queryFn: getCustomerWallet,
  });

  useRefreshOnFocus(refetch);

  const wallet = data?.wallet;
  const transactions = data?.transactions ?? [];

  // Top Up Modal State
  const [isTopUpVisible, setIsTopUpVisible] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayModalVisible, setRazorpayModalVisible] = useState(false);
  const [activeRazorpayData, setActiveRazorpayData] = useState<RazorpayPaymentData | null>(null);
  const [pendingTopupAmount, setPendingTopupAmount] = useState<string>('');

  const handleBack = () => {
    if (razorpayModalVisible) {
      setRazorpayModalVisible(false);
      return;
    }
    if (isTopUpVisible) {
      setIsTopUpVisible(false);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/home');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [razorpayModalVisible, isTopUpVisible]);

  const handleWalletSuccess = async (paymentResponse: RazorpaySuccessResponse) => {
    setRazorpayModalVisible(false);
    setIsProcessing(true);
    try {
      const verifyRes = await verifyCustomerWalletTopUp(paymentResponse);
      if (verifyRes.success) {
        await refetch();
        Alert.alert(
          'Top-up Successful',
          `₹${pendingTopupAmount || ''} added to your Volo Wallet successfully!`
        );
      } else {
        throw new Error(verifyRes.error || 'Payment verification failed.');
      }
    } catch (vErr: any) {
      Alert.alert('Verification Failed', vErr.message || 'Payment verification failed. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalletDismiss = () => {
    setRazorpayModalVisible(false);
    setIsProcessing(false);
  };

  const handleWalletError = (errMsg: string) => {
    setRazorpayModalVisible(false);
    setIsProcessing(false);
    Alert.alert('Payment Failed', errMsg || 'Payment was unsuccessful.');
  };

  const handleOpenTopUp = () => {
    setSelectedAmount(500);
    setCustomAmount('');
    setIsTopUpVisible(true);
  };

  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    if (cleaned) {
      setSelectedAmount(parseInt(cleaned, 10));
    }
  };

  const handleProceedPayment = async () => {
    const finalAmount = customAmount ? parseInt(customAmount, 10) : selectedAmount;
    if (!finalAmount || isNaN(finalAmount) || finalAmount < 100) {
      if (Platform.OS === 'web') {
        alert('Minimum top-up amount is ₹100.');
      } else {
        Alert.alert('Invalid Amount', 'Minimum top-up amount is ₹100.');
      }
      return;
    }

    try {
      setIsProcessing(true);

      // 1. Create top-up order on backend
      const res = await createCustomerWalletTopUpOrder(finalAmount);
      if (!res.success || !res.checkout) {
        throw new Error(res.error || 'Failed to create payment order.');
      }

      const { checkout } = res;

      // 2. Web Razorpay Checkout modal
      if (Platform.OS === 'web') {
        await loadRazorpayScript();
        const RazorpayCheckout = (window as any).Razorpay;
        if (!RazorpayCheckout) {
          throw new Error('Razorpay SDK could not be loaded.');
        }

        const rzp = new RazorpayCheckout({
          key: checkout.keyId,
          amount: checkout.amount,
          currency: checkout.currency || 'INR',
          name: 'VOLO Wallet',
          description: `Add ₹${checkout.displayAmount} to Volo Wallet`,
          order_id: checkout.orderId,
          theme: {
            color: '#45016e',
          },
          handler: async (paymentResponse: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // Verify payment on backend
              const verifyRes = await verifyCustomerWalletTopUp(paymentResponse);
              if (verifyRes.success) {
                setIsTopUpVisible(false);
                setIsProcessing(false);
                await refetch();
                alert(`₹${checkout.displayAmount} added to your Volo Wallet successfully!`);
              } else {
                throw new Error(verifyRes.error || 'Payment verification failed.');
              }
            } catch (vErr: any) {
              alert(vErr.message || 'Verification failed. Please contact support.');
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
        });

        rzp.on('payment.failed', (failRes: any) => {
          setIsProcessing(false);
          alert(failRes?.error?.description || 'Payment was unsuccessful.');
        });

        rzp.open();
      } else {
        // Native (Android / iOS): Open In-App Razorpay Modal (stays inside app)
        setIsTopUpVisible(false);
        setIsProcessing(false);
        setPendingTopupAmount(String(checkout.displayAmount));
        setActiveRazorpayData({
          keyId: checkout.keyId,
          orderId: checkout.orderId,
          amount: checkout.amount,
          currency: checkout.currency || 'INR',
          name: 'VOLO Wallet',
          description: `Add ₹${checkout.displayAmount} to Volo Wallet`,
          themeColor: '#45016e',
        });
        setRazorpayModalVisible(true);
      }
    } catch (err: any) {
      setIsProcessing(false);
      const msg = err.message || 'Payment initiation failed.';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Payment Error', msg);
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white shadow-sm">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold">{t('wallet.title') || 'Volo Wallet'}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--primary))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="rgb(var(--danger))" />
          <Text className="text-text-primary font-bold mt-4 text-center">{t('wallet.failedLoad')}</Text>
          <Text className="text-text-secondary text-xs text-center mt-2 mb-6">
            {t('wallet.failedLoadMsg')}
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Wallet Balance Card */}
          <View className="px-6 pt-6 pb-4">
            <View className="rounded-[28px] overflow-hidden shadow-2xl relative border border-[#45016e]/40">
              <LinearGradient
                colors={['#45016e', '#350055', '#1E1535']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 22 }}
              >
                {/* Decorative Glow */}
                <View 
                  style={{
                    position: 'absolute',
                    right: -24,
                    top: -24,
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  }} 
                />
                
                <Text className="text-purple-200 text-[10px] font-black uppercase tracking-wider mb-2">
                  {t('wallet.availableBalance') || 'Available Balance'}
                </Text>
                <Text className="text-white text-4xl font-black mb-5 tracking-tight">
                  {formatCurrency(wallet?.balance ?? 0)}
                </Text>

                <TouchableOpacity
                  onPress={handleOpenTopUp}
                  activeOpacity={0.88}
                  className="bg-white h-11 rounded-xl flex-row items-center justify-center space-x-2 active:bg-slate-100 self-start px-5 shadow-md"
                >
                  <Ionicons name="add-circle" size={17} color="#45016e" />
                  <Text className="text-[#45016e] font-black text-xs">{t('wallet.addFunds') || 'Top Up Balance'}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>

          {/* Transactions List Header */}
          <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider px-6 py-3">{t('wallet.transactions') || 'Transaction Ledger'}</Text>

          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={false}
            renderItem={({ item }) => (
              <Card variant="default" className="p-4 mb-3 border-border-primary">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <Text className="text-text-primary text-sm font-extrabold" numberOfLines={1}>
                      {item.description || t('wallet.defaultDesc')}
                    </Text>
                    <Text className="text-text-muted text-[10px] mt-1 font-semibold">
                      {formatDateTime(item.created_at)}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm font-extrabold ${
                      (item.amount ?? 0) >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {(item.amount ?? 0) >= 0 ? '+' : ''}
                    {formatCurrency(item.amount ?? 0)}
                  </Text>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="receipt-outline"
                title={t('wallet.noTransactions')}
                message={t('wallet.noTransactionsMsg')}
              />
            }
          />
        </View>
      )}

      {/* Top Up Bottom Sheet / Modal */}
      <Modal
        visible={isTopUpVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isProcessing && setIsTopUpVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-border-primary">
            {/* Modal Handle & Header */}
            <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-4" />
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text className="text-text-primary text-lg font-black tracking-tight">Top Up Volo Wallet</Text>
                <Text className="text-text-secondary text-xs mt-0.5">Add digital balance to pay instantly for bookings</Text>
              </View>
              <TouchableOpacity
                onPress={() => !isProcessing && setIsTopUpVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-100 justify-center items-center"
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <Text className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2.5">
              Select Amount
            </Text>
            <View className="flex-row gap-2 mb-4">
              {[500, 1000, 2000, 5000].map((amt) => {
                const isSelected = !customAmount && selectedAmount === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => handleSelectPreset(amt)}
                    activeOpacity={0.8}
                    className={`flex-1 py-3 rounded-2xl items-center border transition-all ${
                      isSelected
                        ? 'bg-[#45016e] border-[#45016e]'
                        : 'bg-background-secondary border-border-primary'
                    }`}
                  >
                    <Text
                      className={`font-black text-sm ${
                        isSelected ? 'text-white' : 'text-text-primary'
                      }`}
                    >
                      ₹{amt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Amount Input */}
            <Text className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2">
              Or Enter Custom Amount
            </Text>
            <View className="flex-row items-center bg-background-secondary border border-border-primary rounded-2xl px-4 py-3 mb-5 focus:border-[#45016e]">
              <Text className="text-text-primary font-black text-lg mr-2">₹</Text>
              <TextInput
                keyboardType="numeric"
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                placeholder="e.g. 1500 (Min ₹100)"
                placeholderTextColor="#94A3B8"
                className="flex-1 text-text-primary font-extrabold text-base p-0"
              />
            </View>

            {/* Payment Methods Info Box */}
            <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 mb-6 flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-emerald-500/20 justify-center items-center">
                <Ionicons name="shield-checkmark" size={18} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-emerald-900 font-extrabold text-xs">Secured by Razorpay</Text>
                <Text className="text-emerald-700 text-[11px] font-medium mt-0.5">
                  UPI (GPay, PhonePe, Paytm, BHIM) • NetBanking • Cards
                </Text>
              </View>
            </View>

            {/* Proceed Pay Button */}
            <TouchableOpacity
              onPress={handleProceedPayment}
              disabled={isProcessing}
              activeOpacity={0.88}
              className={`py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg mb-2 ${
                isProcessing ? 'bg-slate-400' : 'bg-[#45016e] active:bg-[#340053]'
              }`}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white font-black text-sm">Processing Payment...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="flash" size={16} color="#FFFFFF" />
                  <Text className="text-white font-black text-sm">
                    Proceed to Pay ₹{customAmount ? customAmount : selectedAmount}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text className="text-center text-text-muted text-[11px] font-medium mt-1 mb-2">
              Funds are credited directly to your Volo Wallet upon verified payment.
            </Text>
          </View>
        </View>
      </Modal>

      {/* In-App Razorpay Checkout Modal (Pure In-App Experience) */}
      <RazorpayModal
        visible={razorpayModalVisible}
        checkout={activeRazorpayData}
        onSuccess={handleWalletSuccess}
        onDismiss={handleWalletDismiss}
        onError={handleWalletError}
      />
    </SafeAreaView>
  );
}
