import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSettlements } from '@/api/settlements';
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
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['worker-settlements'],
    queryFn: getSettlements,
  });

  useRefreshOnFocus(refetch);

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
          onPress={() => router.back()}
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
          <View className="px-6 pt-6 pb-4">
            <Card variant="brand-orange" className="p-6 relative overflow-hidden bg-brand-orange/5 border-brand-orange/15 shadow-premium">
              {/* Decorative Glow */}
              <View className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-brand-orange/10" />

              <Text className="text-brand-orange text-xs font-bold uppercase tracking-wider mb-2">
                {t('settlements.totalPayouts')}
              </Text>
              <Text className="text-text-primary text-4xl font-extrabold">
                {formatCurrency(totalPayout)}
              </Text>
            </Card>
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
