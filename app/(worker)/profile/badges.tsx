import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

const EARNED_BADGES = [
  {
    id: 1,
    name: 'Top Rated Pro',
    icon: 'star',
    color: '#D97706',
    bg: '#FEF3C7',
    date: 'Jun 10, 2026',
    description: 'Maintained a 4.8+ rating over 50 completed jobs.'
  },
  {
    id: 2,
    name: 'Lightning Fast',
    icon: 'flash',
    color: '#0284C7',
    bg: '#E0F2FE',
    date: 'May 22, 2026',
    description: 'Responded to 95% of job broadcast offers in under 2 minutes.'
  },
  {
    id: 3,
    name: 'Century Club',
    icon: 'trophy',
    color: '#059669',
    bg: '#D1FAE5',
    date: 'Apr 15, 2026',
    description: 'Successfully completed 100 service dispatches on VOLO.'
  },
];

const UPCOMING_BADGES = [
  {
    id: 4,
    name: 'Elite Professional',
    progress: 75,
    target: 'Maintain 95+ Quality Score for 3 Months',
    icon: 'ribbon',
    color: '#7C3AED',
  },
  {
    id: 5,
    name: 'Veteran Partner',
    progress: 35,
    target: 'Complete 500 Service Jobs',
    icon: 'shield-checkmark',
    color: '#EA580C',
  },
];

export default function WorkerBadgesScreen() {
  const router = useRouter();

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
        <Text className="text-slate-800 text-lg font-black">Badges & Achievements</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* Banner */}
        <View className="bg-amber-500 rounded-3xl p-6 mb-5 shadow-premium text-white relative overflow-hidden" style={{ backgroundColor: '#D97706' }}>
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="medal" size={20} color="#FEF3C7" />
            <Text className="text-amber-100 text-xs font-black uppercase tracking-wider">Captain Recognition</Text>
          </View>
          <Text className="text-white text-xl font-black">Badges Highlight Your Skills</Text>
          <Text className="text-amber-100 text-xs font-medium mt-1 leading-relaxed">
            Badges are showcased directly to customers when they accept your offers, increasing trust and customer tip rates.
          </Text>
        </View>

        {/* Earned Badges Section */}
        <View className="mb-6">
          <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">
            Earned Badges ({EARNED_BADGES.length})
          </Text>
          {EARNED_BADGES.map((badge) => (
            <Card key={badge.id} className="p-4 mb-3 bg-white border-border-primary flex-row items-center gap-3.5">
              <View
                style={{ backgroundColor: badge.bg }}
                className="w-12 h-12 rounded-2xl items-center justify-center border border-black/5"
              >
                <Ionicons name={badge.icon as any} size={24} color={badge.color} />
              </View>
              <View className="flex-1">
                <Text className="text-text-primary text-sm font-black">{badge.name}</Text>
                <Text className="text-text-secondary text-xs mt-0.5 leading-snug">{badge.description}</Text>
                <Text className="text-slate-400 text-[10px] font-semibold mt-1 font-mono">Unlocked: {badge.date}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Upcoming Badges Section */}
        <View className="mb-6">
          <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">
            In Progress & Upcoming
          </Text>
          {UPCOMING_BADGES.map((badge) => (
            <Card key={badge.id} className="p-4 mb-3 bg-white border-border-primary">
              <View className="flex-row items-center gap-3 mb-2.5">
                <View className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center">
                  <Ionicons name={badge.icon as any} size={18} color={badge.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-text-primary text-xs font-black">{badge.name}</Text>
                  <Text className="text-text-secondary text-[11px] mt-0.5">{badge.target}</Text>
                </View>
                <Text className="text-slate-700 text-xs font-black font-mono">{badge.progress}%</Text>
              </View>
              {/* Progress Bar */}
              <View className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <View
                  style={{ width: `${badge.progress}%`, backgroundColor: badge.color }}
                  className="h-full rounded-full"
                />
              </View>
            </Card>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
