import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getWorkerEarnings, topUpWorkerWallet } from '@/api/wallet';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDateTime } from '@/utils/formatDate';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/Button';

export default function WorkerWalletScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['worker-earnings'],
    queryFn: getWorkerEarnings,
  });

  useRefreshOnFocus(refetch);

  const earnings = data?.earnings ?? { balance: 0, minimum_balance: 500 };
  const transactions = data?.transactions ?? [];

  const handleTopUp = () => {
    if (Platform.OS === 'web') {
      const amountStr = window.prompt("Enter amount to top up (₹):", "500");
      if (amountStr) {
        const amt = parseFloat(amountStr);
        if (isNaN(amt) || amt <= 0) {
          alert("Please enter a valid amount.");
          return;
        }
        submitTopUp(amt);
      }
    } else {
      Alert.prompt(
        t('wallet.topUpTitle'),
        "Enter amount to top up (₹):",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Top Up", 
            onPress: (val?: string) => {
              const amt = parseFloat(val || '0');
              if (isNaN(amt) || amt <= 0) {
                Alert.alert("Error", "Please enter a valid amount.");
                return;
              }
              submitTopUp(amt);
            } 
          }
        ],
        "plain-text",
        "500"
      );
    }
  };

  const submitTopUp = async (amount: number) => {
    try {
      await topUpWorkerWallet(amount);
      refetch();
      if (Platform.OS === 'web') {
        alert(`Successfully topped up ₹${amount}!`);
      } else {
        Alert.alert("Success", `Successfully topped up ₹${amount}!`);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to top up wallet.";
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white shadow-sm">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold">{t('wallet.workerWallet')}</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="rgb(var(--danger))" />
          <Text className="text-text-primary font-bold mt-4">{t('wallet.failedLoadEarnings')}</Text>
          <Text className="text-text-secondary text-xs text-center mt-2 mb-6">
            {t('wallet.failedLoadEarningsMsg')}
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Wallet Balance Card */}
          <View className="px-6 pt-6 pb-4">
            <View 
              style={{ backgroundColor: 'rgb(var(--brand-orange))' }}
              className="p-6 relative overflow-hidden rounded-3xl shadow-premium"
            >
              {/* Decorative Glow */}
              <View className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-white/10" />
              
              <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider mb-2">
                {t('wallet.commissionBalance')}
              </Text>
              <Text className="text-white text-3xl font-extrabold mb-1">
                {formatCurrency(earnings.balance)}
              </Text>
              <Text className="text-white/70 text-[10px] leading-4 mb-4">
                {t('wallet.minimumBalance')}: <Text className="text-white font-bold">{formatCurrency(earnings.minimum_balance)}</Text>
              </Text>

              <TouchableOpacity
                onPress={handleTopUp}
                activeOpacity={0.9}
                className="bg-white h-10 rounded-xl flex-row items-center justify-center space-x-2 active:bg-slate-50 self-start px-5"
              >
                <Ionicons name="add-circle" size={16} color="rgb(var(--brand-orange))" />
                <Text className="text-brand-orange font-bold text-xs">{t('wallet.addFunds')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Transactions list header */}
          <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider px-6 py-3">{t('wallet.earningsHistory')}</Text>

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
                      {item.description || t('wallet.jobSettlement')}
                    </Text>
                    <Text className="text-text-muted text-[10px] mt-1 font-semibold">
                      {formatDateTime(item.created_at)}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm font-extrabold ${
                      item.amount >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {item.amount >= 0 ? '+' : ''}
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="receipt-outline"
                title={t('wallet.noTransactions')}
                message={t('wallet.noTransactionsMsgWorker')}
              />
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}
