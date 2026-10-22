import { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, TextInput, BackHandler } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSettlements, getWorkerBankAccount, updateWorkerUpiId } from '@/api/settlements';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { useLanguage } from '@/hooks/useLanguage';

export default function WorkerSettlementsScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(worker)/home');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['worker-settlements'],
    queryFn: getSettlements,
  });

  const { data: bankData, refetch: refetchBank } = useQuery({
    queryKey: ['worker-bank-account'],
    queryFn: getWorkerBankAccount,
  });

  useRefreshOnFocus(refetch);
  useRefreshOnFocus(refetchBank);

  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);

  const account = bankData?.account || null;

  async function handleSaveUpi() {
    const clean = upiInput.trim();
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(clean)) {
      alert('Invalid UPI ID format. Example: mobile@upi or name@okaxis');
      return;
    }
    setSavingUpi(true);
    try {
      const res = await updateWorkerUpiId(clean);
      if (res?.success) {
        await refetchBank();
        setIsEditingUpi(false);
        alert('Instant UPI ID linked successfully!');
      } else {
        alert(res?.error || 'Failed to link UPI ID.');
      }
    } catch (e: any) {
      alert(e.message || 'Network error.');
    } finally {
      setSavingUpi(false);
    }
  }

  const settlements = data?.settlements ?? [];
  const totalPayout = data?.total ?? 0;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'PROCESSING':
        return 'warning';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
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
        <Text className="text-text-primary text-lg font-extrabold">{t('settlements.title')}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="rgb(var(--danger))" />
          <Text className="text-text-primary font-bold mt-4">{t('settlements.failedLoad')}</Text>
          <Text className="text-text-secondary text-xs text-center mt-2 mb-6">
            {t('settlements.failedLoadMsg')}
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Total Settlements Summary */}
          <View className="px-6 pt-5 pb-3">
            <Card variant="brand-orange" className="p-5 relative overflow-hidden bg-brand-orange/5 border-brand-orange/15 shadow-premium">
              <View className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-brand-orange/10" />

              <Text className="text-brand-orange text-xs font-bold uppercase tracking-wider mb-1">
                {t('settlements.totalPayouts')}
              </Text>
              <Text className="text-text-primary text-3xl font-extrabold">
                {formatCurrency(totalPayout)}
              </Text>
            </Card>

            {/* Payout Destination Card (Bank & Instant UPI) */}
            <View className="mt-3 p-4 rounded-2xl bg-white border border-border-primary shadow-sm">
              <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
                <Text className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                  Payout Destination
                </Text>
                <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Ionicons name="flash" size={10} color="#047857" />
                  <Text className="text-[9px] font-extrabold text-emerald-800 uppercase">
                    {account?.upi_id ? 'Instant UPI Mode' : 'Bank Transfer (IMPS)'}
                  </Text>
                </View>
              </View>

              {account ? (
                <View className="mt-2.5">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-xs font-bold text-text-primary">
                        {account.bank_name || 'Bank Account'}
                      </Text>
                      <Text className="text-[11px] font-mono text-text-muted mt-0.5">
                        {account.masked_account_number || `•••• ${account.account_last_four}`} • {account.ifsc_code}
                      </Text>
                    </View>
                    <Badge
                      label={account.verification_status || 'VERIFIED'}
                      variant={account.verification_status === 'VERIFIED' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </View>

                  {/* UPI VPA Display / Inline Update */}
                  <View className="mt-2.5 pt-2 border-t border-slate-100">
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-[10px] font-extrabold uppercase text-slate-400">
                          Linked UPI ID (Zero Fee)
                        </Text>
                        <Text className="text-xs font-black text-brand-orange font-mono mt-0.5">
                          {account.upi_id || 'Not linked'}
                        </Text>
                      </View>
                      {!isEditingUpi && (
                        <TouchableOpacity
                          onPress={() => {
                            setUpiInput(account.upi_id || '');
                            setIsEditingUpi(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 active:bg-slate-200"
                        >
                          <Text className="text-[10px] font-bold text-slate-700">
                            {account.upi_id ? 'Change' : '+ Link UPI'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isEditingUpi && (
                      <View className="mt-2 flex-row items-center gap-2">
                        <TextInput
                          placeholder="e.g. mobile@upi"
                          value={upiInput}
                          onChangeText={setUpiInput}
                          autoCapitalize="none"
                          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-text-primary"
                        />
                        <TouchableOpacity
                          onPress={handleSaveUpi}
                          disabled={savingUpi}
                          className="px-3 py-1.5 rounded-xl bg-brand-orange active:bg-orange-600"
                        >
                          {savingUpi ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text className="text-xs font-bold text-white">Save</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setIsEditingUpi(false)}
                          className="px-2 py-1.5"
                        >
                          <Text className="text-xs font-bold text-slate-400">Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <Text className="text-xs text-text-muted mt-2">
                  No bank account linked. Payouts require a verified bank account.
                </Text>
              )}
            </View>
          </View>

          {/* Settlements List */}
          <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider px-6 py-3">{t('settlements.payoutCycles')}</Text>

          <FlatList
            data={settlements}
            keyExtractor={(item) => item.id}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={false}
            renderItem={({ item }) => (
              <Card variant="default" className="p-4 mb-3 border-border-primary">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-text-primary text-sm font-extrabold">
                    {t('settlements.weekEnding')}: {formatDate(item.week_end_date)}
                  </Text>
                  <Badge
                    label={item.status}
                    variant={getStatusVariant(item.status)}
                    size="sm"
                  />
                </View>
                <View className="flex-row justify-between items-center mt-1">
                  <Text className="text-text-muted text-[10px] font-medium">
                    {t('settlements.payoutId')}: {item.razorpayx_payout_id || t('settlements.localTransfer')}
                  </Text>
                  <Text className="text-text-primary text-base font-extrabold">
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="card-outline"
                title={t('settlements.noPayouts')}
                message={t('settlements.noPayoutsMsg')}
              />
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}
