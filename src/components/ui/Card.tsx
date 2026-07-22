import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  variant?: 'default' | 'muted' | 'brand' | 'brand-orange';
}

export function Card({
  children,
  className = '',
  variant = 'default',
  ...props
}: CardProps) {
  let bgStyle = 'bg-background-card border-border-primary shadow-premium';
  
  if (variant === 'muted') {
    bgStyle = 'bg-background-secondary border-transparent';
  } else if (variant === 'brand') {
    bgStyle = 'bg-primary/5 border-primary/10';
  } else if (variant === 'brand-orange') {
    bgStyle = 'bg-brand-orange/5 border-brand-orange/10';
  }

  return (
    <View
      className={`rounded-3xl border p-5 ${bgStyle} ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
