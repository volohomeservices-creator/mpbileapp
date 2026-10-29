import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCustomerReviews } from '@/api/profile';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CustomerReviewsScreen() {
  const router = useRouter();

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
    queryKey: ['customer-my-reviews'],
    queryFn: getCustomerReviews,
  });

  useRefreshOnFocus(refetch);

  const reviews = data?.reviews || [];

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
        <Text className="text-slate-800 text-lg font-black">My Reviews</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--primary))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">Loading your reviews…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {reviews.length === 0 ? (
            <EmptyState
              icon="star-outline"
              title="No Reviews Yet"
              message="Your ratings and feedback left for service captains will be organized here."
            />
          ) : (
            reviews.map((rev: any) => {
              const rating = Number(rev.rating || 5);
              const serviceName = rev.bookings?.service_items?.name || 'Home Service';
              const workerName = rev.workers?.users?.full_name || 'Volo Captain';
              const dateStr = rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }) : '';

              return (
                <Card key={rev.id} className="p-5 mb-4 bg-white border-border-primary">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 pr-3">
                      <Text className="text-text-primary text-sm font-black">{serviceName}</Text>
                      <Text className="text-text-secondary text-xs font-semibold mt-0.5">Captain: {workerName}</Text>
                    </View>
                    <View className="flex-row items-center bg-amber-50 px-2 py-1 rounded-xl border border-amber-200">
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text className="text-amber-800 text-xs font-black ml-1">{rating.toFixed(1)}</Text>
                    </View>
                  </View>

                  {/* Comment */}
                  {rev.comment ? (
                    <Text className="text-slate-700 text-xs leading-relaxed my-2 italic">
                      &quot;{rev.comment}&quot;
                    </Text>
                  ) : null}

                  <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-100">
                    <Text className="text-slate-400 text-[10px] font-medium font-mono">{dateStr}</Text>
                    {rev.would_recommend ? (
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="thumbs-up" size={11} color="#059669" />
                        <Text className="text-emerald-700 text-[10px] font-black">Recommended</Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
