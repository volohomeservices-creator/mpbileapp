import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, BackHandler, Modal, Share } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getInvoices } from '@/api/profile';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatCurrency';

export default function CustomerInvoicesScreen() {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/profile');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (selectedInvoice) {
        setSelectedInvoice(null);
        return true;
      }
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedInvoice]);

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

  const handleShareInvoice = async (inv: any) => {
    try {
      await Share.share({
        title: `Volo Tax Invoice ${inv.invoice_no}`,
        message: `Tax Invoice ${inv.invoice_no}\nService: ${inv.bookings?.service_items?.name || 'Home Maintenance'}\nAmount: ${formatCurrency(Number(inv.amount))}\nStatus: ${inv.status}\nDate: ${timeLabel(inv.created_at)}\nDownloaded via Volo Home Services App.`,
      });
    } catch (err: any) {
      console.error('Error sharing invoice:', err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header block */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-slate-100 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleBack}
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
                message="Invoices and billing receipts are automatically generated here upon captain job completions."
              />
            ) : (
              invoices.map((item: any) => {
                const badge = getStatusConfig(item.status);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedInvoice(item)}
                    activeOpacity={0.9}
                  >
                    <Card className="border-slate-100 bg-white p-5 mb-4 rounded-3xl shadow-sm">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-4">
                          <Text className="text-indigo-600 text-[10px] font-black tracking-wider uppercase font-mono">
                            {item.invoice_no}
                          </Text>
                          <Text className="text-slate-800 text-sm font-extrabold mt-1.5" numberOfLines={2}>
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

                      <View className="mt-3 pt-3 border-t border-slate-100 flex-row justify-between items-center">
                        <Text className="text-primary text-xs font-bold">View Tax Breakdown</Text>
                        <Ionicons name="chevron-forward" size={14} color="rgb(var(--primary))" />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Invoice Breakdown Modal */}
      {selectedInvoice && (
        <Modal
          visible={!!selectedInvoice}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedInvoice(null)}
        >
          <View className="flex-1 bg-black/60 justify-end sm:justify-center p-4">
            <View className="bg-white rounded-3xl p-6 shadow-2xl max-h-[85%]">
              <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <View>
                  <Text className="text-[10px] font-mono text-indigo-600 font-black uppercase">
                    {selectedInvoice.invoice_no}
                  </Text>
                  <Text className="text-slate-900 text-base font-black mt-0.5">Tax Invoice Breakdown</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedInvoice(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold">Service Rendered</Text>
                  <Text className="text-slate-900 text-sm font-black">
                    {selectedInvoice.bookings?.service_items?.name || 'Home Maintenance Service'}
                  </Text>
                  <Text className="text-slate-500 text-xs font-medium font-mono mt-1">
                    Invoice Date: {timeLabel(selectedInvoice.created_at)}
                  </Text>
                </View>

                {/* Price Math */}
                <View className="space-y-2.5 px-1 py-2">
                  <View className="flex-row justify-between text-xs">
                    <Text className="text-slate-600 text-xs font-medium">Base Service Fee</Text>
                    <Text className="text-slate-900 text-xs font-bold font-mono">
                      {formatCurrency(Number((selectedInvoice.amount * 0.82).toFixed(2)))}
                    </Text>
                  </View>
                  <View className="flex-row justify-between text-xs">
                    <Text className="text-slate-600 text-xs font-medium">Platform Fee</Text>
                    <Text className="text-slate-900 text-xs font-bold font-mono">₹29.00</Text>
                  </View>
                  <View className="flex-row justify-between text-xs">
                    <Text className="text-slate-600 text-xs font-medium">GST & Taxes (18%)</Text>
                    <Text className="text-slate-900 text-xs font-bold font-mono">
                      {formatCurrency(Number((selectedInvoice.amount * 0.18).toFixed(2)))}
                    </Text>
                  </View>
                  <View className="h-px bg-slate-200 my-1" />
                  <View className="flex-row justify-between items-center text-sm pt-1">
                    <Text className="text-slate-900 text-sm font-black">Total Paid</Text>
                    <Text className="text-indigo-600 text-lg font-black font-mono">
                      {formatCurrency(Number(selectedInvoice.amount))}
                    </Text>
                  </View>
                </View>

                {/* Status and Method */}
                <View className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text className="text-emerald-800 text-xs font-bold">Payment Verified via Online / Volo Wallet</Text>
                </View>

                {/* Actions */}
                <View className="flex-row gap-3 pt-2">
                  <Button
                    label="Share Receipt"
                    variant="primary"
                    size="md"
                    onPress={() => handleShareInvoice(selectedInvoice)}
                    className="flex-1"
                  />
                  <Button
                    label="Close"
                    variant="outline"
                    size="md"
                    onPress={() => setSelectedInvoice(null)}
                    className="flex-1"
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

