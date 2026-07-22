import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getInvoices } from '@/api/profile';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatCurrency';

export default function CustomerInvoicesScreen() {
  const router = useRouter();

  // Fetch Invoices Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices,
  });

  useRefreshOnFocus(refetch);

  const invoices = data?.invoices ?? [];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PAID':
        return { bg: '#ecfdf5', text: '#047857', border: '#d1fae5', label: 'Paid' };
      case 'PENDING':
        return { bg: '#fffbeb', text: '#b45309', border: '#fef3c7', label: 'Pending' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: 'Generated' };
    }
  };

  const timeLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header block */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-slate-100 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-slate-50 justify-center items-center mr-3 active:bg-slate-100"
          >
            <Ionicons name="arrow-back" size={18} color="#1e293b" />
          </TouchableOpacity>
          <Text className="text-slate-800 text-lg font-black">My Invoices</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="text-slate-500 text-xs mt-2 font-medium">Loading invoices…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="px-6 pt-6">
            {invoices.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No invoices yet"
                message="Invoices and billing receipts are automatically generated here upon technician job completions."
              />
            ) : (
              invoices.map((item: any) => {
                const badge = getStatusConfig(item.status);
                return (
                  <Card key={item.id} className="border-slate-100 bg-white p-5 mb-4 rounded-3xl shadow-sm">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-4">
                        <Text className="text-indigo-600 text-[10px] font-black tracking-wider uppercase font-mono">
                          {item.invoice_no}
                        </Text>
                        <Text className="text-slate-805 text-sm font-extrabold mt-1.5" numberOfLines={2}>
                          {item.bookings?.service_items?.name || 'Home Maintenance Service'}
                        </Text>
                        <Text className="text-slate-400 text-[10px] font-semibold mt-1 font-mono">
                          Issued: {timeLabel(item.created_at)}
                        </Text>
                      </View>

                      <View className="items-end select-none">
                        <Text className="text-slate-800 text-sm font-black mb-2">
                          {formatCurrency(Number(item.amount))}
                        </Text>
                        <View
                          style={{ backgroundColor: badge.bg, borderColor: badge.border }}
                          className="px-2.5 py-0.5 rounded border"
                        >
                          <Text style={{ color: badge.text }} className="text-[8px] font-black uppercase font-mono">
                            {badge.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
