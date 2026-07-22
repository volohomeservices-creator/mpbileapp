import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error loading this information. Please check your internet connection and try again.',
  onRetry,
  retryLabel = 'Try Again',
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8 bg-transparent">
      <View className="w-16 h-16 bg-danger/10 rounded-3xl items-center justify-center mb-6 border border-danger/20">
        <Ionicons name="alert-circle" size={32} color="rgb(var(--danger))" />
      </View>
      <Text className="text-text-primary text-base font-extrabold text-center mb-2">{title}</Text>
      <Text className="text-text-secondary text-xs text-center mb-6 leading-5 max-w-[280px]">
        {message}
      </Text>
      {onRetry ? (
        <Button label={retryLabel} variant="secondary" onPress={onRetry} className="min-w-[160px]" />
      ) : null}
    </View>
  );
}
