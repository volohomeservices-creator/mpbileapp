import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, BackHandler, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getWorkerReferrals } from '@/api/profile';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/formatCurrency';

export default function WorkerReferralsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(worker)/profile');
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
    queryKey: ['worker-referrals', user?.id],
    queryFn: getWorkerReferrals,
    enabled: !!user?.id,
  });

  useRefreshOnFocus(refetch);

  const code = data?.code || 'VOLOWK-PARTNER';
  const stats = data?.stats || { successCount: 0, pendingCount: 0, totalEarned: 0, pendingAmount: 0 };
  const settings = data?.settings || { referrer_reward: 500, referee_reward: 0, min_bookings_to_qualify: 5 };
  const referrals = data?.referrals || [];

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied!', `Captain referral code "${code}" copied to clipboard.`);
  };

  const handleWhatsAppShare = async () => {
    const text = `👷‍♂️ Hey! Join the Volo Captain network! Earn on your own schedule with weekly payouts. Use my invite code *${code}* when onboarding:\n\nRegister: https://voloapp.in/partner?ref=${code}`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
      }
    } catch {
      await Share.share({
        message: text,
        title: 'Become a Volo Captain',
      });
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join the Volo Captain network! Earn on your own schedule with weekly payouts. Use my invite code ${code} when onboarding: https://voloapp.in/partner?ref=${code}`,
        title: 'Become a Volo Captain',
      });
    } catch (err: any) {
      console.error('Error sharing worker referral code:', err);
    }
  };

  const eligibility = data?.eligibility ?? { isEligible: true, completedJobs: 1, minReferrerJobs: 1 };

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
        <Text className="text-slate-800 text-lg font-black">Refer a Captain</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">Loading referral details…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          
          {/* Captain Eligibility Banner */}
          {!eligibility.isEligible ? (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex-row items-start gap-3">
              <Ionicons name="alert-circle" size={20} color="#D97706" style={{ marginTop: 1 }} />
              <View className="flex-1">
                <Text className="text-amber-900 text-xs font-black">Complete Jobs to Unlock Earnings</Text>
                <Text className="text-amber-800 text-[11px] mt-0.5 leading-tight">
                  You have completed {eligibility.completedJobs}/{eligibility.minReferrerJobs} jobs. Complete at least {eligibility.minReferrerJobs} job(s) to activate your captain referral bonus deposits!
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/jobs')}
                  className="mt-2 bg-[#EA580C] self-start px-3 py-1.5 rounded-lg active:scale-95"
                >
                  <Text className="text-white text-[10px] font-black uppercase">View Available Jobs</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-4 flex-row items-center gap-2.5">
              <Ionicons name="shield-checkmark" size={18} color="#059669" />
              <Text className="text-emerald-900 text-xs flex-1">
                <Text className="font-black">Captain Fleet Bonus Active: </Text>
                Earn {formatCurrency(settings.referrer_reward)} per recruit once they complete {settings.min_bookings_to_qualify} jobs!
              </Text>
            </View>
          )}

          {/* Hero Banner */}
          <View className="rounded-3xl p-6 mb-5 shadow-premium text-white relative overflow-hidden" style={{ backgroundColor: '#EA580C' }}>
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="people" size={20} color="#FEF3C7" />
              <Text className="text-amber-200 text-xs font-black uppercase tracking-wider">Captain Fleet Growth</Text>
            </View>
            <Text className="text-white text-xl font-black leading-tight">
              Earn {formatCurrency(settings.referrer_reward)} per Onboarded Captain
            </Text>
            <Text className="text-orange-100 text-xs font-medium mt-1.5 leading-relaxed">
              Invite skilled professionals to join Volo. Once they complete {settings.min_bookings_to_qualify} bookings, you receive {formatCurrency(settings.referrer_reward)} in your settlements account.
            </Text>

            {/* Code Box */}
            <View className="mt-5 bg-white/10 border border-white/20 rounded-2xl p-3 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] uppercase font-bold text-orange-200 tracking-wider">Your Captain Code</Text>
                <Text className="text-white font-mono text-lg font-black tracking-widest mt-0.5">{code}</Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={handleCopy}
                  activeOpacity={0.8}
                  className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl flex-row items-center gap-1"
                >
                  <Ionicons name="copy-outline" size={13} color="#ffffff" />
                  <Text className="text-white text-xs font-bold">Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleWhatsAppShare}
                  activeOpacity={0.8}
                  className="bg-[#25D366] px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Ionicons name="logo-whatsapp" size={14} color="#ffffff" />
                  <Text className="text-white text-xs font-black">WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 shadow-premium">
              <Text className="text-text-secondary text-[10px] font-bold uppercase">Total Earned</Text>
              <Text className="text-text-primary text-lg font-black mt-1 font-mono">{formatCurrency(stats.totalEarned)}</Text>
            </View>
            <View className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 shadow-premium">
              <Text className="text-text-secondary text-[10px] font-bold uppercase">Qualified</Text>
              <Text className="text-emerald-600 text-lg font-black mt-1 font-mono">{stats.successCount}</Text>
            </View>
            <View className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 shadow-premium">
              <Text className="text-text-secondary text-[10px] font-bold uppercase">Pending</Text>
              <Text className="text-amber-500 text-lg font-black mt-1 font-mono">{stats.pendingCount}</Text>
            </View>
          </View>

          {/* Captain Referrals List */}
          <View className="mb-6">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">Referred Captains</Text>
            {referrals.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 border border-border-primary items-center justify-center">
                <Ionicons name="person-add-outline" size={32} color="rgb(var(--text-muted))" />
                <Text className="text-text-primary text-xs font-extrabold mt-2">No captain invites yet</Text>
                <Text className="text-text-secondary text-[11px] text-center mt-1">Share your code with friends in the home service trades to start earning bonuses!</Text>
              </View>
            ) : (
              referrals.map((item: any) => (
                <View key={item.id} className="bg-white rounded-2xl p-4 border border-border-primary mb-2.5 flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-text-primary text-xs font-bold">Partner #{item.id.slice(0, 8)}</Text>
                    <Text className="text-text-secondary text-[10px] mt-0.5">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-text-primary text-xs font-black font-mono">
                      +{formatCurrency(Number(item.reward_amount || settings.referrer_reward))}
                    </Text>
                    <Text className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                      item.status === 'REWARDED' ? 'text-emerald-600' : 'text-amber-500'
                    }`}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}
