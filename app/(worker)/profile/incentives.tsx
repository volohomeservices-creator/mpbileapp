import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

const ACTIVE_CHALLENGES = [
  {
    id: 1,
    title: 'Weekend Warrior',
    description: 'Complete 10 jobs this weekend to unlock an extra bonus payout.',
    reward: '₹1,500',
    target: 10,
    current: 6,
    endsIn: '2 days left',
    color: '#10B981',
  },
  {
    id: 2,
    title: 'Flawless 5',
    description: 'Get five consecutive 5-star customer ratings without incident.',
    reward: '₹500',
    target: 5,
    current: 3,
    endsIn: 'Ongoing',
    color: '#F59E0B',
  },
];

const INCENTIVE_PAYOUTS = [
  { id: 101, title: 'First 50 Dispatches', reward: '₹2,000', status: 'PAID', date: 'May 10, 2026' },
  { id: 102, title: 'Festival Surge Bonus', reward: '₹1,000', status: 'APPROVED', date: 'Jun 12, 2026' },
  { id: 103, title: 'Perfect Shift Attendance', reward: '₹750', status: 'PENDING', date: 'Jun 01, 2026' },
];

export default function WorkerIncentivesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'challenges' | 'history'>('challenges');

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
        <Text className="text-slate-800 text-lg font-black">Incentives & Challenges</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-6 bg-white border-b border-border-primary">
        <TouchableOpacity
          onPress={() => setActiveTab('challenges')}
          activeOpacity={0.8}
          className={`flex-1 py-3 items-center ${activeTab === 'challenges' ? 'border-b-2 border-b-brand-orange' : ''}`}
        >
          <Text className={`text-xs font-black uppercase tracking-wider ${activeTab === 'challenges' ? 'text-brand-orange' : 'text-slate-400'}`}>
            Active Challenges
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          activeOpacity={0.8}
          className={`flex-1 py-3 items-center ${activeTab === 'history' ? 'border-b-2 border-b-brand-orange' : ''}`}
        >
          <Text className={`text-xs font-black uppercase tracking-wider ${activeTab === 'history' ? 'text-brand-orange' : 'text-slate-400'}`}>
            Payout History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {activeTab === 'challenges' ? (
          <View className="space-y-4">
            {/* Hero info card */}
            <View className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-3xl p-5 mb-3 shadow-premium text-white" style={{ backgroundColor: '#EA580C' }}>
              <View className="flex-row items-center gap-2 mb-1.5">
                <Ionicons name="flame" size={18} color="#FEF3C7" />
                <Text className="text-amber-200 text-xs font-black uppercase tracking-wider">Weekly Booster</Text>
              </View>
              <Text className="text-white text-lg font-black">Boost Your Weekly Take-Home</Text>
              <Text className="text-orange-100 text-xs font-medium mt-1 leading-relaxed">
                Meet weekly delivery & service milestones to receive cash rewards directly into your settlements wallet.
              </Text>
            </View>

            {ACTIVE_CHALLENGES.map((ch) => {
              const progressPct = Math.min(100, Math.round((ch.current / ch.target) * 100));
              return (
                <Card key={ch.id} className="p-5 mb-3 bg-white border-border-primary">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 pr-3">
                      <Text className="text-text-primary text-base font-black">{ch.title}</Text>
                      <Text className="text-text-secondary text-xs mt-1 leading-snug">{ch.description}</Text>
                    </View>
                    <View className="bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-2xl">
                      <Text className="text-brand-orange text-sm font-black font-mono">{ch.reward}</Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center text-xs mt-3 mb-1.5">
                    <Text className="text-slate-500 text-xs font-bold font-mono">
                      {ch.current} of {ch.target} completed
                    </Text>
                    <Text className="text-slate-400 text-[10px] font-semibold">{ch.endsIn}</Text>
                  </View>

                  <View className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <View
                      style={{ width: `${progressPct}%`, backgroundColor: ch.color }}
                      className="h-full rounded-full"
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <View className="space-y-3">
            {INCENTIVE_PAYOUTS.map((item) => (
              <Card key={item.id} className="p-4 mb-2.5 bg-white border-border-primary flex-row justify-between items-center">
                <View className="flex-1 pr-3">
                  <Text className="text-text-primary text-xs font-black">{item.title}</Text>
                  <Text className="text-slate-400 text-[10px] font-mono mt-0.5">{item.date}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-text-primary text-sm font-black font-mono text-emerald-600">+{item.reward}</Text>
                  <View className="px-2 py-0.5 rounded-md bg-slate-100 mt-1">
                    <Text className="text-[8px] font-black uppercase font-mono text-slate-700">{item.status}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
