import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'brand';
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle = 'rounded-xl items-center justify-center flex-row active:scale-98 transition-transform duration-100';
  
  let variantStyle = 'bg-primary';
  let textStyle = 'text-white font-semibold tracking-wide';
  
  if (variant === 'primary') {
    variantStyle = disabled || loading ? 'bg-primary/50' : 'bg-primary active:bg-primary-light';
    textStyle = 'text-white font-bold';
  } else if (variant === 'secondary') {
    variantStyle = disabled || loading ? 'bg-background-secondary opacity-60' : 'bg-background-secondary border border-border-secondary active:bg-slate-100';
    textStyle = 'text-text-secondary font-semibold';
  } else if (variant === 'outline') {
    variantStyle = disabled || loading ? 'border border-border-secondary opacity-60' : 'border border-border-secondary bg-transparent active:bg-background-secondary';
    textStyle = 'text-text-secondary font-semibold';
  } else if (variant === 'danger') {
    variantStyle = disabled || loading ? 'bg-danger/50' : 'bg-danger active:bg-danger/90';
    textStyle = 'text-white font-bold';
  } else if (variant === 'ghost') {
    variantStyle = disabled || loading ? 'opacity-40' : 'active:bg-background-secondary';
    textStyle = 'text-primary font-bold';
  } else if (variant === 'brand') {
    variantStyle = disabled || loading ? 'bg-brand-orange/50' : 'bg-brand-orange active:bg-brand-orange/95';
    textStyle = 'text-white font-bold';
  }

  let sizeStyle = 'py-3.5 px-6 h-12';
  let textSize = 'text-sm';
  if (size === 'sm') {
    sizeStyle = 'py-2 px-4 h-9';
    textSize = 'text-xs';
  } else if (size === 'lg') {
    sizeStyle = 'py-4 px-8 h-14';
    textSize = 'text-base';
  }

  let inlineBg: string | undefined = undefined;
  if (variant === 'primary') {
    inlineBg = disabled || loading ? 'rgba(60, 1, 167, 0.45)' : '#3C01A7';
  } else if (variant === 'brand') {
    inlineBg = disabled || loading ? 'rgba(60, 1, 167, 0.45)' : '#3C01A7';
  } else if (variant === 'danger') {
    inlineBg = disabled || loading ? 'rgba(239, 68, 68, 0.45)' : '#EF4444';
  } else if (variant === 'secondary') {
    inlineBg = '#F8FAFC';
  }

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      activeOpacity={0.85}
      className={`${baseStyle} ${variantStyle} ${sizeStyle} ${className}`}
      style={[{ backgroundColor: inlineBg }, props.style]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' || variant === 'ghost' ? 'rgb(var(--primary))' : '#ffffff'} 
          size="small" 
          className="mr-2" 
        />
      ) : null}
      <Text className={`${textStyle} ${textSize}`}>{label}</Text>
    </TouchableOpacity>
  );
}
