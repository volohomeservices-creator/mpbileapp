import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Pressable, Platform, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getActiveBookings, getBookingHistory, submitReview } from '@/api/bookings';
import { BookingCard } from '@/components/BookingCard';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function BookingsListScreen() {
  const router = useRouter();
  const { openReview } = useLocalSearchParams<{ openReview?: string }>();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Review Modal State
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');

  useEffect(() => {
    if (openReview) {
      setActiveTab('history');
      setReviewBookingId(openReview);
    }
  }, [openReview]);

  // Queries
  const {
    data: activeData,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['active-bookings'],
    queryFn: getActiveBookings,
    enabled: activeTab === 'active',
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['booking-history'],
    queryFn: getBookingHistory,
    enabled: activeTab === 'history',
  });

  // Submit Review Mutation
  const reviewMutation = useMutation({
    mutationFn: submitReview,
    onSuccess: () => {
      Alert.alert(t('bookings.reviewSuccess'), t('bookings.submitReviewSuccess'));
      queryClient.invalidateQueries({ queryKey: ['booking-history'] });
      closeReviewModal();
    },
    onError: (err: any) => {
      Alert.alert(t('bookings.reviewError'), err?.response?.data?.error ?? t('bookings.submitReviewFailed'));
    }
  });

  const bookings = activeTab === 'active' ? activeData?.bookings ?? [] : historyData?.bookings ?? [];
  const loading = activeTab === 'active' ? activeLoading : historyLoading;
  const refetch = activeTab === 'active' ? refetchActive : refetchHistory;

  const openReviewModal = (bookingId: string) => {
    setReviewBookingId(bookingId);
    setRating(5);
    setComment('');
  };

  const closeReviewModal = () => {
    setReviewBookingId(null);
  };

  const handleSubmitReview = () => {
    if (!reviewBookingId) return;
    reviewMutation.mutate({
      booking_id: reviewBookingId,
      rating,
      comment: comment.trim()
    });
  };

  const renderReviewContent = () => (
    <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }} className="flex-1 justify-center items-center p-6">
      <Card variant="default" className="p-6 w-full max-w-[340px] border border-border-primary shadow-xl bg-white">
        <Text className="text-text-primary text-base font-extrabold mb-1">{t('bookings.ratePartner')}</Text>
        <Text className="text-text-secondary text-xs mb-5 font-semibold leading-4">
          {t('bookings.shareExp')}
        </Text>

        {/* Stars selection row */}
        <View className="flex-row justify-center gap-3 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              hitSlop={8}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={30}
                color={star <= rating ? 'rgb(var(--primary))' : 'rgb(var(--text-muted))'}
              />
            </Pressable>
          ))}
        </View>

        {/* Comment input */}
        <TextInput
          multiline
          numberOfLines={4}
          value={comment}
          onChangeText={setComment}
          placeholder={t('bookings.reviewPlaceholder')}
          placeholderTextColor="rgb(var(--text-muted))"
          className="bg-background-secondary border border-border-secondary rounded-2xl p-4 text-text-primary text-sm h-28 mb-6 focus:border-primary focus:bg-background-card"
          textAlignVertical="top"
        />

        {/* Action Row */}
        <View className="flex-row gap-3">
          <Button
            label={t('common.cancel')}
            variant="outline"
            size="sm"
            disabled={reviewMutation.isPending}
            onPress={closeReviewModal}
            className="flex-1"
          />
          <Button
            label={t('common.save')}
            variant="primary"
            size="sm"
            disabled={reviewMutation.isPending}
            loading={reviewMutation.isPending}
            onPress={handleSubmitReview}
            className="flex-1"
          />
        </View>
      </Card>
    </View>
  );

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
        <Text className="text-text-primary text-lg font-extrabold flex-1">{t('bookings.title')}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-6 bg-white border-b border-border-primary shadow-sm">
        <TouchableOpacity
          onPress={() => setActiveTab('active')}
          activeOpacity={0.9}
          className={`flex-1 py-3 items-center ${activeTab === 'active' ? 'border-b-2 border-b-primary' : ''}`}
        >
          <Text className={`text-sm font-extrabold ${activeTab === 'active' ? 'text-primary' : 'text-text-muted'}`}>
            {t('bookings.activeTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          activeOpacity={0.9}
          className={`flex-1 py-3 items-center ${activeTab === 'history' ? 'border-b-2 border-b-primary' : ''}`}
        >
          <Text className={`text-sm font-extrabold ${activeTab === 'history' ? 'text-primary' : 'text-text-muted'}`}>
            {t('bookings.historyTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="rgb(var(--primary))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onPress={() => router.push(`/(customer)/bookings/${item.id}`)}
              onWriteReview={() => openReviewModal(item.id)}
            />
          )}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'active' ? 'calendar-outline' : 'file-tray-outline'}
              title={activeTab === 'active' ? t('bookings.noActiveTitle') : t('bookings.noHistoryTitle')}
              message={
                activeTab === 'active'
                  ? t('bookings.noActiveMsg')
                  : t('bookings.noHistoryMsg')
              }
              actionLabel={activeTab === 'active' ? t('bookings.bookService') : undefined}
              onAction={activeTab === 'active' ? () => router.push('/(customer)/home') : undefined}
            />
          }
        />
      )}

      {/* Review Submission Modal/Overlay */}
      {reviewBookingId !== null && Platform.OS === 'web' && (
        <View style={StyleSheet.absoluteFill} className="z-50">
          {renderReviewContent()}
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Modal
          visible={reviewBookingId !== null}
          transparent
          animationType="fade"
          onRequestClose={closeReviewModal}
        >
          {renderReviewContent()}
        </Modal>
      )}
    </SafeAreaView>
  );
}
