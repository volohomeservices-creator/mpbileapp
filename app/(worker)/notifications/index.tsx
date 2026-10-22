import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getNotifications, markNotificationRead, markAllRead } from '@/api/notifications';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { NotificationItem } from '@/components/NotificationItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/hooks/useLanguage';

export default function WorkerNotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(worker)/home');
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
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  useRefreshOnFocus(refetch);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    markAllReadMutation.mutate();
  };

  const handleNotificationPress = (id: string, isRead: boolean) => {
    if (!isRead) {
      markReadMutation.mutate(id);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-border-primary bg-white shadow-sm">
        <View className="flex-row items-center flex-1 mr-4">
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
          >
            <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
          </TouchableOpacity>
          <Text className="text-text-primary text-lg font-extrabold">{t('notifications.title')}</Text>
          {unreadCount > 0 ? (
            <View className="bg-brand-orange rounded-full h-5 min-w-[20px] px-1.5 justify-center items-center ml-2.5">
              <Text className="text-white text-[10px] font-extrabold">{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            activeOpacity={0.8}
            className="flex-row items-center space-x-1 active:opacity-60"
          >
            <Ionicons name="checkmark-done" size={16} color="rgb(var(--brand-orange))" />
            <Text className="text-brand-orange text-xs font-bold">{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => handleNotificationPress(item.id, item.is_read)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title={t('notifications.inboxEmpty')}
              message={t('notifications.inboxEmptyMsgWorker')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
