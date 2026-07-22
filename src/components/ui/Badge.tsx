import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand' | 'brand-orange';
  size?: 'sm' | 'md';
}

export function Badge({
  label,
  variant = 'default',
  size = 'md',
}: BadgeProps) {
  let containerStyle = 'bg-background-secondary border-border-secondary';
  let textStyle = 'text-text-secondary';

  if (variant === 'success') {
    containerStyle = 'bg-success/10 border-success/20';
    textStyle = 'text-success';
  } else if (variant === 'warning') {
    containerStyle = 'bg-warning/10 border-warning/20';
    textStyle = 'text-warning';
  } else if (variant === 'error') {
    containerStyle = 'bg-danger/10 border-danger/20';
    textStyle = 'text-danger';
  } else if (variant === 'info') {
    containerStyle = 'bg-info/10 border-info/20';
    textStyle = 'text-info';
  } else if (variant === 'brand') {
    containerStyle = 'bg-primary/10 border-primary/20';
    textStyle = 'text-primary';
  } else if (variant === 'brand-orange') {
    containerStyle = 'bg-brand-orange/10 border-brand-orange/20';
    textStyle = 'text-brand-orange';
  }

  const paddingStyle = size === 'sm' ? 'px-2 py-0.5 rounded-md' : 'px-3 py-1.5 rounded-full';
  const fontSizeStyle = size === 'sm' ? 'text-[9px] font-bold tracking-wide uppercase' : 'text-xs font-bold';

  return (
    <View className={`border inline-flex items-center justify-center self-start ${paddingStyle} ${containerStyle}`}>
      <Text className={`${textStyle} ${fontSizeStyle}`}>{label}</Text>
    </View>
  );
}
