import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, BackHandler, ScrollView } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setSecurityPin } from '@/api/profile';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function SecurityPinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/profile');
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

  const pinMutation = useMutation({
    mutationFn: setSecurityPin,
    onSuccess: () => {
      Alert.alert(
        'PIN Updated Successfully',
        'Your 4-digit security PIN is now active and protected with bank-grade encryption.',
        [{ text: 'Done', onPress: handleBack }]
      );
      setPin('');
      setConfirmPin('');
    },
    onError: (err: any) => {
      Alert.alert('Setup Failed', err?.response?.data?.error || 'Unable to update security PIN. Please try again.');
    },
  });

  const handleSave = () => {
    if (pin.length !== 4) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit security PIN.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('Mismatch', 'PIN and Confirm PIN do not match. Please re-enter.');
      return;
    }
    const weakList = ['0000', '1111', '1234', '4321', '9999'];
    if (weakList.includes(pin)) {
      Alert.alert('Weak PIN', 'This PIN is too common. Please choose a stronger combination.');
      return;
    }

    pinMutation.mutate(pin);
  };

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-full bg-slate-50 justify-center items-center mr-3 active:bg-slate-100 border border-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-slate-800 text-lg font-black">Security PIN</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Banner */}
        <View className="items-center my-4">
          <View className="w-16 h-16 rounded-3xl bg-primary/10 items-center justify-center mb-3">
            <Ionicons name="lock-closed" size={30} color="rgb(var(--primary))" />
          </View>
          <Text className="text-text-primary text-xl font-black">Set 4-Digit Security PIN</Text>
          <Text className="text-text-secondary text-xs text-center mt-1.5 max-w-xs font-medium">
            Your Security PIN adds an extra layer of protection for wallet withdrawals, sensitive profile edits, and fast logins.
          </Text>
        </View>

        {/* Inputs */}
        <Card className="p-5 mb-5 bg-white">
          <View className="space-y-4">
            <View className="mb-4">
              <Text className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                New 4-Digit PIN
              </Text>
              <TextInput
                value={pin}
                onChangeText={(val) => setPin(val.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                placeholderTextColor="rgb(var(--text-muted))"
                keyboardType="number-pad"
                secureTextEntry
                className="w-full bg-background-secondary border border-border-secondary rounded-2xl p-4 text-center text-text-primary text-2xl font-mono font-black tracking-[0.5em] focus:border-primary"
                maxLength={4}
              />
            </View>

            <View className="mb-4">
              <Text className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                Confirm 4-Digit PIN
              </Text>
              <TextInput
                value={confirmPin}
                onChangeText={(val) => setConfirmPin(val.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                placeholderTextColor="rgb(var(--text-muted))"
                keyboardType="number-pad"
                secureTextEntry
                className="w-full bg-background-secondary border border-border-secondary rounded-2xl p-4 text-center text-text-primary text-2xl font-mono font-black tracking-[0.5em] focus:border-primary"
                maxLength={4}
              />
            </View>
          </View>

          <Button
            label={pinMutation.isPending ? 'Saving PIN…' : 'Activate Security PIN'}
            variant="primary"
            size="lg"
            disabled={pinMutation.isPending || pin.length !== 4 || confirmPin.length !== 4}
            loading={pinMutation.isPending}
            onPress={handleSave}
            className="w-full mt-2"
          />
        </Card>

        {/* Tips */}
        <View className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/60">
          <View className="flex-row items-center gap-2 mb-1.5">
            <Ionicons name="shield-checkmark" size={16} color="rgb(var(--primary))" />
            <Text className="text-primary text-xs font-black">Security Advisory</Text>
          </View>
          <Text className="text-text-secondary text-[11px] leading-relaxed">
            Never share your Volo PIN or OTP with anyone, including customer service agents or home service captains.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
