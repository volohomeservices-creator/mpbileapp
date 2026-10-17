import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCustomerWallet, topUpCustomerWallet } from '@/api/wallet';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDateTime } from '@/utils/formatDate';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/Button';

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
      await topUpCustomerWallet(amount);
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
        <Text className="text-text-primary text-lg font-extrabold">{t('wallet.title')}</Text>
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
            <View className="rounded-[28px] overflow-hidden shadow-2xl relative border border-purple-800/40">
              <LinearGradient
                colors={['#18073E', '#2D0C7B', '#4C1D95']}
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
                  onPress={handleTopUp}
                  activeOpacity={0.88}
                  className="bg-white h-11 rounded-xl flex-row items-center justify-center space-x-2 active:bg-slate-100 self-start px-5 shadow-md"
                >
                  <Ionicons name="add-circle" size={17} color="#3C01A7" />
                  <Text className="text-[#3C01A7] font-black text-xs">{t('wallet.addFunds')}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>

          {/* Transactions List Header */}
          <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider px-6 py-3">{t('wallet.transactions')}</Text>

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
    </SafeAreaView>
  );
}
