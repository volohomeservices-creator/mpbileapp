import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, BackHandler } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAddresses, addAddress, deleteAddress, setDefaultAddress } from '@/api/profile';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SavedAddressesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // States
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('HOME');
  const [newAddressText, setNewAddressText] = useState('');

  const handleBack = () => {
    if (isAdding) {
      setIsAdding(false);
      return;
    }
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
  }, [isAdding]);

  // Fetch Addresses Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: getAddresses,
  });

  useRefreshOnFocus(refetch);

  const addresses = data?.addresses ?? [];

  // Mutations
  const addMutation = useMutation({
    mutationFn: addAddress,
    onSuccess: (res) => {
      if (res.success) {
        Alert.alert('Success', 'Address saved successfully.');
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        setNewAddressText('');
        setIsAdding(false);
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to save address.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to delete address.');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to set default address.');
    },
  });

  const handleAddSubmit = () => {
    if (!newAddressText.trim()) {
      Alert.alert('Validation', 'Please enter a valid address.');
      return;
    }
    addMutation.mutate({
      label: newLabel,
      address: newAddressText.trim(),
      is_default: addresses.length === 0,
    });
  };

  const handleDeletePress = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this saved location?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const getLabelIcon = (label: string) => {
    switch (label) {
      case 'HOME':
        return 'home-outline';
      case 'WORK':
        return 'briefcase-outline';
      default:
        return 'map-outline';
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'HOME':
        return { bg: '#eff6ff', text: '#2563eb' }; // blue
      case 'WORK':
        return { bg: '#f0fdf4', text: '#16a34a' }; // green
      default:
        return { bg: '#faf5ff', text: '#7c3aed' }; // purple
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header block */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-slate-100 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleBack}
            className="w-9 h-9 rounded-full bg-slate-50 justify-center items-center mr-3 active:bg-slate-100"
          >
            <Ionicons name="arrow-back" size={18} color="#1e293b" />
          </TouchableOpacity>
          <Text className="text-slate-800 text-lg font-black">Saved Locations</Text>
        </View>

        {!isAdding && (
          <TouchableOpacity
            onPress={() => setIsAdding(true)}
            className="w-9 h-9 rounded-full bg-indigo-50 justify-center items-center active:bg-indigo-100"
          >
            <Ionicons name="add" size={20} color="#6366f1" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="text-slate-500 text-xs mt-2 font-medium">Loading saved locations…</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Add New Location Card Form */}
          {isAdding && (
            <View className="m-6 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm animate-fade-in-up">
              <Text className="text-slate-850 text-xs font-black uppercase tracking-wider mb-4">Add New Location</Text>

              {/* Label selector */}
              <View className="space-y-1.5 mb-4">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Label</Text>
                <View className="flex-row gap-2">
                  {['HOME', 'WORK', 'OTHER'].map((lbl) => (
                    <TouchableOpacity
                      key={lbl}
                      onPress={() => setNewLabel(lbl)}
                      className={`px-4 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                        newLabel === lbl
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <Ionicons name={getLabelIcon(lbl) as any} size={14} color={newLabel === lbl ? '#6366f1' : '#64748b'} />
                      <Text className={`text-xs font-bold ${newLabel === lbl ? 'text-indigo-600' : 'text-slate-550'}`}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Address textarea */}
              <View className="space-y-1.5 mb-4">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Full Address</Text>
                <TextInput
                  value={newAddressText}
                  onChangeText={setNewAddressText}
                  placeholder="Enter apartment, building, street name, pincode..."
                  placeholderTextColor="#cbd5e1"
                  multiline
                  numberOfLines={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-850 text-sm font-semibold min-h-[80px]"
                />
              </View>

              {/* Form buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setIsAdding(false)}
                  className="flex-1 h-10 border border-slate-200 rounded-xl items-center justify-center active:bg-slate-50"
                >
                  <Text className="text-slate-500 font-extrabold text-xs">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddSubmit}
                  disabled={addMutation.isPending}
                  className="flex-1 h-10 bg-indigo-600 rounded-xl items-center justify-center active:bg-indigo-700"
                >
                  {addMutation.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-extrabold text-xs">Save Address</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* List of locations */}
          <View className="px-6 pt-6">
            {addresses.length === 0 && !isAdding ? (
              <EmptyState
                icon="map-outline"
                title="No saved locations"
                message="Save your home, office, or regular service addresses for a faster checkout next time."
              />
            ) : (
              addresses.map((item: any) => {
                const colorConfig = getLabelColor(item.label);
                return (
                  <Card key={item.id} className="border-slate-100 bg-white p-3.5 mb-3 rounded-2xl shadow-sm relative">
                    {/* Default badge */}
                    {item.is_default && (
                      <View className="absolute top-3 right-3 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                        <Ionicons name="star" size={8} color="#059669" />
                        <Text className="text-emerald-700 text-[8px] font-black uppercase tracking-wider">Default</Text>
                      </View>
                    )}

                    <View className="flex-row items-start">
                      <View
                        style={{ backgroundColor: colorConfig.bg }}
                        className="w-8 h-8 rounded-xl items-center justify-center mr-3 border border-slate-100"
                      >
                        <Ionicons name={getLabelIcon(item.label) as any} size={15} color={colorConfig.text} />
                      </View>
                      <View className="flex-1 pr-12">
                        <Text className="text-slate-800 text-xs font-black uppercase tracking-wider">{item.label}</Text>
                        <Text className="text-slate-500 text-[11px] mt-1 leading-4">{item.address}</Text>
                      </View>
                    </View>

                    {/* Actions bar */}
                    <View className="flex-row justify-between items-center mt-3.5 pt-3 border-t border-slate-50">
                      <TouchableOpacity
                        onPress={() => handleDeletePress(item.id)}
                        className="w-7 h-7 rounded-lg bg-red-50 justify-center items-center active:bg-red-100"
                      >
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      </TouchableOpacity>

                      {!item.is_default && (
                        <TouchableOpacity
                          onPress={() => setDefaultMutation.mutate(item.id)}
                          className="px-2.5 py-1 bg-slate-50 rounded-lg active:bg-slate-100"
                        >
                          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                            Set as Default
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
