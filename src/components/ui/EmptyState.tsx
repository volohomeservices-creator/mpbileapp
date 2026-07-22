import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.prototype.props | string;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title = 'No items found',
  message = 'There is nothing to display here at the moment.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8 bg-transparent">
      <View className="w-16 h-16 bg-background-secondary rounded-3xl items-center justify-center mb-6 border border-border-secondary">
        <Ionicons name={icon as any} size={28} color="rgb(var(--primary))" />
      </View>
      <Text className="text-text-primary text-base font-extrabold text-center mb-2">{title}</Text>
      <Text className="text-text-secondary text-xs text-center mb-6 leading-5 max-w-[280px]">
        {message}
      </Text>
      {onAction && actionLabel ? (
        <Button label={actionLabel} variant="primary" onPress={onAction} className="min-w-[160px]" />
      ) : null}
    </View>
  );
}
