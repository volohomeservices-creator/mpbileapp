import { View, TextInput, Text, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: string;
}

export function Input({
  label,
  error,
  containerStyle = '',
  className = '',
  ...props
}: InputProps) {
  return (
    <View className={`w-full mb-4 ${containerStyle}`}>
      {label ? (
        <Text className="text-text-secondary text-xs font-bold tracking-wide uppercase mb-1.5">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor="rgb(var(--text-muted))"
        className={`w-full h-12 px-4 rounded-xl border bg-background-secondary text-text-primary text-sm border-border-secondary focus:border-primary focus:bg-background-card ${
          error ? 'border-danger focus:border-danger' : ''
        } ${className}`}
        {...props}
      />
      {error ? (
        <Text className="text-danger text-xs mt-1.5 font-semibold">{error}</Text>
      ) : null}
    </View>
  );
}
