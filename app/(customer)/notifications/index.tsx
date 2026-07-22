import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getNotifications, markNotificationRead, markAllRead } from '@/api/notifications';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { NotificationItem } from '@/components/NotificationItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/hooks/useLanguage';

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  useRefreshOnFocus(refetch);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark single read mutation
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
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-slate-100 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-slate-50 justify-center items-center mr-3 active:bg-slate-100"
          >
            <Ionicons name="arrow-back" size={18} color="#1e293b" />
          </TouchableOpacity>
          <Text className="text-slate-800 text-xl font-bold">{t('notifications.title')}</Text>
          {unreadCount > 0 ? (
            <View className="bg-indigo-600 rounded-full h-5 min-w-[20px] px-1.5 justify-center items-center ml-2.5">
              <Text className="text-white text-[10px] font-extrabold">{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            className="flex-row items-center space-x-1 active:opacity-60"
          >
            <Ionicons name="checkmark-done" size={16} color="#6366f1" />
            <Text className="text-indigo-600 text-xs font-bold">{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="text-slate-500 text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
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
              message={t('notifications.inboxEmptyMsg')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
