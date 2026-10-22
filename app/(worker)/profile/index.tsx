import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getWorkerProfile, updateWorkerProfile, deactivateWorkerAccount } from '@/api/profile';
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

export default function WorkerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  // Platform-resilient showAlert helper
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const { t, language: currentLanguage, setLanguage } = useLanguage();
  const languages = LANGUAGES;

  // States
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Fetch Profile Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['worker-profile'],
    queryFn: getWorkerProfile,
  });

  useRefreshOnFocus(refetch);

  const userProfile = data as any;
  const workerInfo = data as any;

  const startEditing = () => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setEmail(userProfile.email || '');
      setIsEditing(true);
    }
  };

  // Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: updateWorkerProfile,
    onSuccess: (res) => {
      if (res.success) {
        Alert.alert('Success', 'Profile updated successfully.');
        queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
        setIsEditing(false);
      }
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err?.response?.data?.error ?? 'Unable to update profile.');
    },
  });

  // Delete Account Mutation
  const deactivationMutation = useMutation({
    mutationFn: deactivateWorkerAccount,
    onSuccess: () => {
      showAlert('Account Deletion Scheduled', 'Your Captain account has been deactivated and scheduled for permanent deletion within 30 days.');
      logout();
    },
    onError: (err: any) => {
      showAlert('Request Failed', err?.response?.data?.error ?? 'Unable to delete account. Contact support@voloapp.in.');
    },
  });

  const handleDeactivate = () => {
    Alert.alert(
      'Delete Captain Account & Data',
      'Are you sure you want to permanently delete your Volo Captain account?\n\n• Your active session will be terminated immediately.\n• Your onboarding and KYC document records will be purged within 30 days.\n• Statutory financial earnings & settlement invoices will be retained as legally mandated.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: () => deactivationMutation.mutate() }
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
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-medium">{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          
          {/* Header Profile Area */}
          <View className="flex-row justify-between items-start mb-4 mt-2">
            <View className="space-y-1 flex-1 pr-4">
              <View className="flex-row">
                <Badge
                  label={workerInfo?.kyc_status === 'APPROVED' ? t('profile.verifiedCustomer') : t('profile.incompleteProfile')}
                  variant={workerInfo?.kyc_status === 'APPROVED' ? 'success' : 'error'}
                />
              </View>

              <Text className="text-text-primary text-2xl font-extrabold tracking-tight leading-snug mt-1.5">
                {userProfile?.full_name || 'Volo Captain'}
              </Text>
              <Text className="text-text-secondary text-xs font-semibold mt-0.5">
                {userProfile?.phone || '+91 9390884905'}
              </Text>
            </View>

            {/* Edit / Complete Profile Action */}
            <TouchableOpacity
              onPress={() => isEditing ? setIsEditing(false) : startEditing()}
              activeOpacity={0.8}
              className="border border-border-secondary rounded-xl px-3.5 py-2 bg-white active:bg-slate-50 shadow-sm flex-row items-center gap-1.5"
            >
              <Ionicons 
                name={isEditing ? "close-outline" : "pencil-outline"} 
                size={14} 
                color="rgb(var(--text-primary))" 
              />
              <Text className="text-text-primary text-xs font-extrabold">
                {isEditing ? t('common.cancel') : (isProfileIncomplete ? t('profile.completeProfile') : t('profile.editProfile'))}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Details editing */}
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
                    variant="brand"
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
            {/* Shifts Card */}
            <TouchableOpacity
              onPress={() => router.push('/(worker)/home')}
              activeOpacity={0.9}
              className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 justify-between min-h-[96px] shadow-premium active:bg-slate-50"
            >
              <Ionicons name="speedometer-outline" size={20} color="rgb(var(--brand-orange))" />
              <Text className="text-text-primary text-xs font-extrabold mt-2 leading-tight">{t('profile.myShifts')}</Text>
            </TouchableOpacity>

            {/* settlements Card */}
            <TouchableOpacity
              onPress={() => router.push('/(worker)/settlements')}
              activeOpacity={0.9}
              className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 justify-between min-h-[96px] shadow-premium active:bg-slate-50"
            >
              <Ionicons name="card-outline" size={20} color="rgb(var(--brand-orange))" />
              <Text className="text-text-primary text-xs font-extrabold mt-2 leading-tight">{t('profile.myPayouts')}</Text>
            </TouchableOpacity>

            {/* Help & Support Card */}
            <TouchableOpacity
              onPress={() => showAlert(t('profile.helpSupport'), 'Reach out to Volo partner helpdesk at partner@volo.app or call 1800-VOLO-PARTNER.')}
              activeOpacity={0.9}
              className="flex-1 bg-white border border-border-primary rounded-2xl p-3.5 justify-between min-h-[96px] shadow-premium active:bg-slate-50"
            >
              <Ionicons name="headset-outline" size={20} color="rgb(var(--brand-orange))" />
              <Text className="text-text-primary text-xs font-extrabold mt-2 leading-tight">{t('profile.helpSupport')}</Text>
            </TouchableOpacity>
          </View>

          {/* Settings Rows List */}
          <View className="divide-y divide-border-primary border-t border-b border-border-primary mb-6 bg-white rounded-3xl overflow-hidden px-4 shadow-premium">
            
            {/* Settlements & Payouts */}
            <TouchableOpacity
              onPress={() => router.push('/(worker)/settlements')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="cash-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.settlementsPayouts')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* Wallet & Earnings */}
            <TouchableOpacity
              onPress={() => router.push('/(worker)/wallet')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="wallet-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.earningsWallet')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* Manage Availability */}
            <TouchableOpacity
              onPress={() => router.push('/(worker)/profile/availability')}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.manageAvailability')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
            </TouchableOpacity>

            {/* KYC status details */}
            <TouchableOpacity
              onPress={() => router.push('/(worker)/kyc' as any)}
              activeOpacity={0.8}
              className="py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Ionicons name="shield-checkmark-outline" size={16} color="rgb(var(--text-secondary))" className="mr-3" />
                <Text className="text-text-primary text-sm font-semibold">{t('profile.kycVerificationStatus')}</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Text
                  className={`text-[11px] font-bold uppercase ${
                    userProfile?.kyc_status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {userProfile?.kyc_status || 'PENDING'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="rgb(var(--text-muted))" />
              </View>
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
                        borderColor: isActive ? 'rgb(var(--brand-orange))' : 'rgb(var(--border-secondary))',
                        backgroundColor: isActive ? 'rgba(var(--brand-orange) / 0.1)' : '#ffffff',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? '800' : '600',
                          color: isActive ? 'rgb(var(--brand-orange))' : 'rgb(var(--text-secondary))',
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
            variant="brand"
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
              {deactivationMutation.isPending ? 'Deactivating...' : 'Deactivate Captain Account'}
            </Text>
          </TouchableOpacity>

          {/* Refer & earn banner */}
          <View className="mb-4">
            <Card variant="brand-orange" className="p-5 flex-row justify-between items-center relative overflow-hidden bg-brand-orange/5">
              <View className="flex-1 pr-6">
                <Text className="text-text-primary text-sm font-extrabold">Refer a Fellow Captain</Text>
                <Text className="text-text-secondary text-[10px] font-bold mt-1 leading-snug">
                  Invite other professionals to join the Volo Captain fleet and earn bonus rewards.
                </Text>
              </View>
              <View className="w-10 h-10 bg-brand-orange/10 rounded-xl items-center justify-center">
                <Ionicons name="gift-outline" size={20} color="rgb(var(--brand-orange))" />
              </View>
            </Card>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}
