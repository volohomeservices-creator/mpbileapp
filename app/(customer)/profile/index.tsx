import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, updateCustomerProfile, deactivateAccount } from '@/api/profile';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ProfileUpdateSchema } from '@volo/shared-types';
import { useLanguage } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const LANGUAGES = [
  { code: 'en' as const, nativeLabel: 'English' },
  { code: 'te' as const, nativeLabel: 'తెలుగు' },
  { code: 'hi' as const, nativeLabel: 'हिंदी' },
];

export default function CustomerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  
  const { t, language: currentLanguage, setLanguage } = useLanguage();
  const languages = LANGUAGES;

  // States
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Fetch Profile Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  useRefreshOnFocus(refetch);

  const userProfile = data as any;

  // Initialize fields when editing starts
  const startEditing = () => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setEmail(userProfile.email || '');
      setIsEditing(true);
    }
  };

  // Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: updateCustomerProfile,
    onSuccess: (res) => {
      if (res.success) {
        Alert.alert('Success', 'Profile updated successfully.');
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setIsEditing(false);
      }
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err?.response?.data?.error ?? 'Unable to update profile.');
    },
  });

  // Deactivate Account Mutation
  const deactivationMutation = useMutation({
    mutationFn: deactivateAccount,
    onSuccess: () => {
      Alert.alert('Account Deactivated', 'Your customer account has been deactivated.');
      logout();
    },
    onError: (err: any) => {
      Alert.alert('Deactivation Failed', err?.response?.data?.error ?? 'Unable to deactivate account.');
    },
  });

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Account',
      'Are you absolutely sure you want to deactivate your Volo customer account?\n\nThis will log you out immediately and set your profile status to inactive.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => deactivationMutation.mutate() }
      ]
    );
  };

  const handleSave = () => {
    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || undefined,
    };

    const validation = ProfileUpdateSchema.safeParse(payload);
    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || 'Validation error';
      Alert.alert('Validation Error', errorMsg);
      return;
    }

    updateMutation.mutate(validation.data);
  };

  const isProfileIncomplete = !userProfile?.email || !userProfile?.full_name;

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--primary))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          
          {/* Header Profile Area */}
          <View className="flex-row justify-between items-start mb-4 mt-2">
            <View className="space-y-1 flex-1 pr-4">
              {/* Profile Status Badge */}
              <View className="flex-row">
                <Badge
                  label={isProfileIncomplete ? t('profile.incompleteProfile') : t('profile.verifiedCustomer')}
                  variant={isProfileIncomplete ? 'error' : 'success'}
                />
              </View>

              <Text className="text-text-primary text-2xl font-extrabold tracking-tight leading-snug mt-1.5">
                {userProfile?.full_name || 'Volo Customer'}
              </Text>
              <Text className="text-text-secondary text-xs font-semibold mt-0.5">
                {userProfile?.phone || '+91 9390884905'}
              </Text>
            </View>

            {/* Complete Profile Action */}
            <TouchableOpacity
              onPress={startEditing}
              activeOpacity={0.8}
              className="border border-border-secondary rounded-xl px-4 py-2 bg-white active:bg-slate-50 shadow-sm"
            >
              <Text className="text-text-primary text-xs font-extrabold">{t('profile.complete')}</Text>
            </TouchableOpacity>
          </View>

          {/* Details form when editing */}
          {isEditing && (
            <View className="mb-6">
              <Card variant="default" className="p-5">
                <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-4">{t('profile.editProfileInfo')}</Text>
                
                <View className="space-y-3 mb-4">
                  <View className="mb-3">
                    <Text className="text-[10px] font-bold text-text-secondary uppercase tracking-wide mb-1.5">{t('profile.fullName')}</Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter your name"
                      placeholderTextColor="rgb(var(--text-muted))"
                      className="w-full bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-sm font-semibold focus:border-primary focus:bg-background-card"
                    />
                  </View>
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-text-secondary uppercase tracking-wide mb-1.5">{t('profile.emailAddress')}</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@email.com"
                      placeholderTextColor="rgb(var(--text-muted))"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      className="w-full bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-sm font-semibold focus:border-primary focus:bg-background-card"
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <Button
                    label={t('common.cancel')}
                    variant="outline"
                    size="sm"
                    onPress={() => setIsEditing(false)}
                    className="flex-1"
                  />
                  <Button
                    label={t('common.save')}
                    variant="primary"
                    size="sm"
                    disabled={updateMutation.isPending}
                    loading={updateMutation.isPending}
                    onPress={handleSave}
                    className="flex-1"
                  />
                </View>
              </Card>
            </View>
          )}

          {/* Cards Quick Actions Row */}
          <View className="flex-row gap-3 mb-6 mt-3">
            {/* Bookings Card */}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/bookings')}
              activeOpacity={0.9}
              className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 justify-between min-h-[96px] shadow-premium active:bg-slate-50"
            >
              <Ionicons name="receipt-outline" size={20} color="rgb(var(--primary))" />
              <Text className="text-text-primary text-xs font-extrabold mt-2 leading-tight">{t('profile.myBookings')}</Text>
            </TouchableOpacity>

            {/* Invoices Card */}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/profile/invoices')}
              activeOpacity={0.9}
              className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 justify-between min-h-[96px] shadow-premium active:bg-slate-50"
            >
              <Ionicons name="document-text-outline" size={20} color="rgb(var(--primary))" />
              <Text className="text-text-primary text-xs font-extrabold mt-2 leading-tight">{t('profile.myInvoices')}</Text>
            </TouchableOpacity>

            {/* Help & Support Card */}
            <TouchableOpacity
              onPress={() => Alert.alert(t('profile.helpSupport'), 'Reach out to Volo partner customer support at support@volo.app or call 1800-VOLO-HELP.')}
              activeOpacity={0.9}
              className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 justify-between min-h-[96px] shadow-premium active:bg-slate-50"
            >
              <Ionicons name="headset-outline" size={20} color="rgb(var(--primary))" />
              <Text className="text-text-primary text-xs font-extrabold mt-2 leading-tight">{t('profile.helpSupport')}</Text>
            </TouchableOpacity>
          </View>

          {/* Settings Rows List */}
          <View className="divide-y divide-border-primary border-t border-b border-border-primary mb-6 bg-white rounded-3xl overflow-hidden px-4 shadow-premium">
            
            {/* Wallet */}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/wallet')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="wallet-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.voloWallet')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* Addresses */}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/profile/addresses')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="map-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.manageAddresses')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* Plus Membership */}
            <TouchableOpacity
              onPress={() => Alert.alert(t('profile.plusMembership'), 'Volo Plus is coming soon with exclusive flat 10% cashbacks!')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="shield-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.plusMembership')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity
              onPress={() => Alert.alert(t('profile.privacyPolicy'), 'Your data is secured with Volo Home Services.')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="lock-closed-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.privacyPolicy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* Language Picker */}
            <View className="py-4">
              <View className="flex-row items-center mb-3">
                <Ionicons name="language-outline" size={16} color="rgb(var(--text-secondary))" />
                <Text className="text-text-primary text-sm font-semibold ml-3">
                  {t('profile.language')}
                </Text>
              </View>
              <View className="flex-row gap-2">
                {languages.map((lang) => {
                  const isActive = currentLanguage === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      onPress={() => setLanguage(lang.code as any)}
                      activeOpacity={0.9}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: isActive ? 2 : 1,
                        borderColor: isActive ? 'rgb(var(--primary))' : 'rgb(var(--border-secondary))',
                        backgroundColor: isActive ? 'rgba(var(--primary) / 0.1)' : '#ffffff',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? '800' : '600',
                          color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--text-secondary))',
                        }}
                      >
                        {lang.nativeLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Bottom Actions CTA */}
          <Button
            label={t('profile.logout')}
            variant="primary"
            size="lg"
            onPress={logout}
            className="w-full mb-3"
          />

          <TouchableOpacity
            onPress={handleDeactivate}
            disabled={deactivationMutation.isPending}
            activeOpacity={0.8}
            className="py-3 items-center justify-center active:opacity-60 mb-6"
          >
            <Text className="text-danger text-xs font-extrabold uppercase tracking-wider">
              {deactivationMutation.isPending ? 'Deactivating...' : t('profile.deactivateAccount')}
            </Text>
          </TouchableOpacity>

          {/* Refer & earn banner */}
          <View className="mb-4">
            <Card variant="brand" className="p-5 flex-row justify-between items-center relative overflow-hidden bg-primary/5">
              <View className="flex-1 pr-6">
                <Text className="text-text-primary text-sm font-extrabold">{t('profile.referEarnTitle')}</Text>
                <Text className="text-text-secondary text-[10px] font-bold mt-1 leading-snug">
                  {t('profile.referEarnSubtitle')}
                </Text>
              </View>
              <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center">
                <Ionicons name="gift-outline" size={20} color="rgb(var(--primary))" />
              </View>
            </Card>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}
