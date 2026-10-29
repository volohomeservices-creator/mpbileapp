import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getWorkerDashboard } from '@/api/jobs';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';

export default function WorkerPerformanceScreen() {
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

  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['worker-performance-dashboard'],
    queryFn: getWorkerDashboard,
  });

  useRefreshOnFocus(refetch);

  const jobsCompleted = dashboardData?.completedJobsCount ?? 0;
  const cancelledJobs = dashboardData?.cancelledJobsCount ?? 0;
  const totalJobs = jobsCompleted + cancelledJobs;
  const rating = dashboardData?.worker?.rating ? Number(dashboardData.worker.rating) : 5.0;
  const completionRate = totalJobs > 0 ? Math.round((jobsCompleted / totalJobs) * 100) : 100;
  const acceptanceRate = totalJobs > 0 ? Math.round(((totalJobs - cancelledJobs) / Math.max(totalJobs, 1)) * 100) : 100;
  const ratingScore = Math.round((rating / 5) * 100);
  const overallScore = Math.round(ratingScore * 0.5 + completionRate * 0.3 + acceptanceRate * 0.2);

  const getScoreInfo = (score: number) => {
    if (score >= 90) return { label: 'Top Tier Partner', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' };
    if (score >= 75) return { label: 'Good Standing', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' };
    if (score >= 50) return { label: 'Average', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' };
    return { label: 'Needs Improvement', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' };
  };

  const scoreInfo = getScoreInfo(overallScore);
  const recentReviews = dashboardData?.recentReviews || [];

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
        <Text className="text-slate-800 text-lg font-black">Performance & Ratings</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">Calculating captain metrics…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          
          {/* Quality Score Hero Card */}
          <View className="rounded-3xl p-6 mb-5 shadow-premium text-white relative overflow-hidden" style={{ backgroundColor: '#0F172A' }}>
            <View className="flex-row justify-between items-start mb-4">
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Captain Health Index</Text>
                <Text className="text-white text-xl font-black mt-0.5">Quality Score</Text>
              </View>
              <View
                style={{ backgroundColor: scoreInfo.bg, borderColor: scoreInfo.border }}
                className="px-2.5 py-1 rounded-full border"
              >
                <Text style={{ color: scoreInfo.color }} className="text-[10px] font-black uppercase tracking-wider">
                  {scoreInfo.label}
                </Text>
              </View>
            </View>

            <View className="items-center py-4">
              <View className="w-28 h-28 rounded-full border-4 border-slate-800 items-center justify-center relative bg-slate-900/60 shadow-inner">
                <Text className="text-white text-3xl font-black font-mono">{overallScore}</Text>
                <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">out of 100</Text>
              </View>
            </View>

            <Text className="text-slate-400 text-xs text-center font-medium">
              High score unlocks priority job dispatches and daily incentive multipliers.
            </Text>
          </View>

          {/* Metric Breakdown Cards */}
          <View className="flex-row gap-3 mb-3">
            <Card className="flex-1 p-4 bg-white border-border-primary">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-text-secondary text-[10px] font-bold uppercase">Customer Rating</Text>
                <Ionicons name="star" size={14} color="#F59E0B" />
              </View>
              <Text className="text-text-primary text-xl font-black font-mono">{rating.toFixed(1)}</Text>
              <Text className="text-slate-400 text-[9px] font-medium mt-0.5">Target: 4.80+</Text>
            </Card>

            <Card className="flex-1 p-4 bg-white border-border-primary">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-text-secondary text-[10px] font-bold uppercase">Completion</Text>
                <Ionicons name="checkmark-done-circle" size={14} color="#10B981" />
              </View>
              <Text className="text-emerald-600 text-xl font-black font-mono">{completionRate}%</Text>
              <Text className="text-slate-400 text-[9px] font-medium mt-0.5">{jobsCompleted} fulfilled</Text>
            </Card>
          </View>

          <View className="flex-row gap-3 mb-5">
            <Card className="flex-1 p-4 bg-white border-border-primary">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-text-secondary text-[10px] font-bold uppercase">Acceptance</Text>
                <Ionicons name="flash" size={14} color="#6366F1" />
              </View>
              <Text className="text-indigo-600 text-xl font-black font-mono">{acceptanceRate}%</Text>
              <Text className="text-slate-400 text-[9px] font-medium mt-0.5">Target: 85%+</Text>
            </Card>

            <Card className="flex-1 p-4 bg-white border-border-primary">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-text-secondary text-[10px] font-bold uppercase">Total Dispatches</Text>
                <Ionicons name="briefcase" size={14} color="#F97316" />
              </View>
              <Text className="text-text-primary text-xl font-black font-mono">{totalJobs}</Text>
              <Text className="text-slate-400 text-[9px] font-medium mt-0.5">Lifetime orders</Text>
            </Card>
          </View>

          {/* Recent Customer Feedback */}
          <View className="mb-6">
            <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">Customer Feedback</Text>
            {recentReviews.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 border border-border-primary items-center justify-center">
                <Ionicons name="chatbubbles-outline" size={32} color="rgb(var(--text-muted))" />
                <Text className="text-text-primary text-xs font-extrabold mt-2">No reviews recorded yet</Text>
                <Text className="text-text-secondary text-[11px] text-center mt-1">Complete your next job with 5-star service to receive feedback!</Text>
              </View>
            ) : (
              recentReviews.map((rev: any) => (
                <View key={rev.id} className="bg-white rounded-2xl p-4 border border-border-primary mb-2.5">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-text-primary text-xs font-black">{rev.customer_name || 'Volo Customer'}</Text>
                    <View className="flex-row items-center bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <Ionicons name="star" size={11} color="#F59E0B" />
                      <Text className="text-amber-800 text-[10px] font-black ml-1">{rev.rating || 5}</Text>
                    </View>
                  </View>
                  {rev.review_text ? (
                    <Text className="text-slate-600 text-xs italic">&quot;{rev.review_text}&quot;</Text>
                  ) : (
                    <Text className="text-slate-400 text-xs italic">Rated 5 stars with no written note.</Text>
                  )}
                </View>
              ))
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}
