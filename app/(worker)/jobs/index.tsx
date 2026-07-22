import { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAvailableJobs, acceptJob, rejectJob } from '@/api/jobs';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { JobCard } from '@/components/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/hooks/useLanguage';
import { Ionicons } from '@expo/vector-icons';

export default function WorkerJobsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['worker-jobs-list', activeTab],
    queryFn: () => getAvailableJobs(activeTab),
  });

  useRefreshOnFocus(refetch);

  // Accept Mutation
  const acceptMutation = useMutation({
    mutationFn: acceptJob,
    onSuccess: (res, id) => {
      if (res.success) {
        Alert.alert(t('workerHome.jobAccepted'), t('workerHome.jobAcceptedMsg'), [
          {
            text: t('workerHome.goToJob'),
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['worker-jobs-list'] });
              queryClient.invalidateQueries({ queryKey: ['worker-active-job'] });
              router.push(`/(worker)/jobs/${id}`);
            },
          },
        ]);
      }
    },
    onError: (err: any) => {
      Alert.alert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectJob(id, 'Not interested'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-jobs-list'] });
      Alert.alert(t('workerHome.declined'), t('workerHome.jobDeclined'));
    },
  });

  const jobs = data?.jobs ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 border-b border-border-primary bg-white shadow-sm flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold flex-1">{t('jobs.jobOffers')}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-6 bg-white border-b border-border-primary shadow-sm">
        <TouchableOpacity
          onPress={() => setActiveTab('available')}
          activeOpacity={0.9}
          className={`flex-1 py-3 items-center ${activeTab === 'available' ? 'border-b-2 border-b-brand-orange' : ''}`}
        >
          <Text className={`text-sm font-extrabold ${activeTab === 'available' ? 'text-brand-orange' : 'text-text-muted'}`}>
            {t('jobs.pendingOffers')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          activeOpacity={0.9}
          className={`flex-1 py-3 items-center ${activeTab === 'history' ? 'border-b-2 border-b-brand-orange' : ''}`}
        >
          <Text className={`text-sm font-extrabold ${activeTab === 'history' ? 'text-brand-orange' : 'text-text-muted'}`}>
            {t('jobs.activePastShifts')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-background-secondary">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : (
        <FlashList
          data={jobs}
          keyExtractor={(item) => item.id}
          estimatedItemSize={200}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() => router.push(`/(worker)/jobs/${item.id}`)}
              showActions={activeTab === 'available'}
              onAccept={() => acceptMutation.mutate(item.id)}
              onReject={() => rejectMutation.mutate(item.id)}
            />
          )}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title={activeTab === 'available' ? t('jobs.noPendingOffers') : t('jobs.noHistoryFound')}
              message={
                activeTab === 'available'
                  ? t('jobs.noPendingOffersMsg')
                  : t('jobs.noHistoryFoundMsg')
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
