import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, BackHandler } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getRewards, convertRewards } from '@/api/profile';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/formatCurrency';

export default function CustomerRewardsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [convertAmount, setConvertAmount] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/profile');
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-rewards'],
    queryFn: getRewards,
  });

  useRefreshOnFocus(refetch);

  const coins = data?.coins ?? 0;
  const history = data?.history ?? [];

  // Determine Tier
  const getTier = (c: number) => {
    if (c >= 5000) return { name: 'Platinum', color: '#6366f1', icon: 'diamond' };
    if (c >= 1500) return { name: 'Gold', color: '#eab308', icon: 'trophy' };
    if (c >= 500) return { name: 'Silver', color: '#94a3b8', icon: 'ribbon' };
    return { name: 'Bronze', color: '#b45309', icon: 'medal' };
  };

  const tier = getTier(coins);

  const conversionMutation = useMutation({
    mutationFn: convertRewards,
    onSuccess: (res) => {
      Alert.alert(
        'Redemption Successful!',
        `Converted ${convertAmount} Volo Coins into ${formatCurrency(res.converted)} wallet balance.`
      );
      setConvertAmount('');
      queryClient.invalidateQueries({ queryKey: ['customer-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['customer-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err: any) => {
      Alert.alert('Conversion Failed', err?.response?.data?.error || 'Unable to convert coins. Please try again.');
    },
  });

  const handleConvert = () => {
    const amount = parseInt(convertAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number of coins to convert.');
      return;
    }
    if (amount > coins) {
      Alert.alert('Insufficient Coins', `You only have ${coins} Volo Coins available.`);
      return;
    }
    if (amount < 10) {
      Alert.alert('Minimum Conversion', 'Minimum conversion is 10 Volo Coins (₹1.00).');
      return;
    }

    conversionMutation.mutate(amount);
  };

  const setPreset = (amt: number) => {
    const target = Math.min(amt, coins);
    setConvertAmount(target.toString());
  };

  const walletValue = convertAmount ? (parseInt(convertAmount, 10) / 10).toFixed(2) : '0.00';

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-full bg-slate-50 justify-center items-center mr-3 active:bg-slate-100 border border-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-slate-800 text-lg font-black">Rewards & Coins</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--primary))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">Loading your reward balance…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          
          {/* Volo Coins Balance Card */}
          <View className="rounded-3xl p-6 mb-5 shadow-premium text-white relative overflow-hidden" style={{ backgroundColor: '#2A1E4A' }}>
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="gift" size={18} color="#FBBF24" />
                <Text className="text-amber-300 text-xs font-black uppercase tracking-wider">Volo Coins</Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-white/10 border border-white/20 flex-row items-center gap-1.5">
                <Ionicons name={tier.icon as any} size={12} color={tier.color} />
                <Text className="text-white text-[10px] font-black tracking-wider uppercase">{tier.name} Tier</Text>
              </View>
            </View>

            <View className="my-2">
              <Text className="text-white text-4xl font-black font-mono tracking-tight">{coins.toLocaleString()}</Text>
              <Text className="text-indigo-200 text-xs font-semibold mt-1">
                ≈ {formatCurrency(coins / 10)} Volo Wallet Cash value (10 Coins = ₹1)
              </Text>
            </View>

            <View className="mt-4 pt-4 border-t border-white/10 flex-row justify-between items-center">
              <Text className="text-white/70 text-xs font-medium">Earn 5% coins on every completed booking</Text>
              <Ionicons name="chevron-forward" size={14} color="#ffffff" />
            </View>
          </View>

          {/* Convert Coins to Wallet Card */}
          <Card className="p-5 mb-5 bg-white">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="swap-horizontal" size={18} color="rgb(var(--primary))" />
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider">Convert to Wallet Balance</Text>
            </View>
            <Text className="text-text-secondary text-xs font-medium mb-4">
              Instantly transfer your coins directly into your Volo Wallet for service payments.
            </Text>

            <View className="bg-background-secondary border border-border-secondary rounded-2xl p-3.5 mb-3 flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-[10px] uppercase font-bold text-text-secondary">Coins to convert</Text>
                <TextInput
                  value={convertAmount}
                  onChangeText={(val) => setConvertAmount(val.replace(/\D/g, ''))}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor="rgb(var(--text-muted))"
                  className="text-text-primary font-mono text-xl font-black mt-1 p-0"
                />
              </View>
              <View className="items-end">
                <Text className="text-[10px] uppercase font-bold text-text-secondary">You get</Text>
                <Text className="text-primary font-mono text-xl font-black mt-1">₹{walletValue}</Text>
              </View>
            </View>

            {/* Presets */}
            <View className="flex-row gap-2 mb-4">
              <TouchableOpacity
                onPress={() => setPreset(100)}
                activeOpacity={0.8}
                className="flex-1 py-1.5 rounded-xl border border-border-secondary items-center bg-white"
              >
                <Text className="text-text-secondary text-[10px] font-bold">100 (₹10)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPreset(500)}
                activeOpacity={0.8}
                className="flex-1 py-1.5 rounded-xl border border-border-secondary items-center bg-white"
              >
                <Text className="text-text-secondary text-[10px] font-bold">500 (₹50)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPreset(1000)}
                activeOpacity={0.8}
                className="flex-1 py-1.5 rounded-xl border border-border-secondary items-center bg-white"
              >
                <Text className="text-text-secondary text-[10px] font-bold">1,000 (₹100)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPreset(coins)}
                activeOpacity={0.8}
                className="flex-1 py-1.5 rounded-xl border border-primary/30 items-center bg-primary/5"
              >
                <Text className="text-primary text-[10px] font-black">All</Text>
              </TouchableOpacity>
            </View>

            <Button
              label={conversionMutation.isPending ? 'Converting…' : 'Redeem to Wallet'}
              variant="primary"
              size="md"
              disabled={conversionMutation.isPending || !convertAmount || parseInt(convertAmount, 10) <= 0 || parseInt(convertAmount, 10) > coins}
              loading={conversionMutation.isPending}
              onPress={handleConvert}
              className="w-full"
            />
          </Card>

          {/* Activity / History */}
          <View className="mb-6">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">Rewards History</Text>
            {history.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 border border-border-primary items-center justify-center">
                <Ionicons name="time-outline" size={32} color="rgb(var(--text-muted))" />
                <Text className="text-text-primary text-xs font-extrabold mt-2">No transactions yet</Text>
                <Text className="text-text-secondary text-[11px] text-center mt-1">Book services to earn Volo Coins with every booking!</Text>
              </View>
            ) : (
              history.map((tx) => {
                const isCredit = tx.amount > 0;
                return (
                  <View key={tx.id} className="bg-white rounded-2xl p-4 border border-border-primary mb-2.5 flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-text-primary text-xs font-bold">{tx.description || (isCredit ? 'Coins Earned' : 'Coins Redeemed')}</Text>
                      <Text className="text-text-secondary text-[10px] mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <Text className={`text-sm font-black font-mono ${isCredit ? 'text-emerald-600' : 'text-purple-600'}`}>
                      {isCredit ? `+${tx.amount}` : tx.amount}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}
