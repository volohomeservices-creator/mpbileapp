import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export interface CityOption {
  id: string;
  name: string;
  state: string;
  hub: boolean;
}

export const POPULAR_CITIES: CityOption[] = [
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', hub: true },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', hub: true },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', hub: true },
  { id: 'delhi-ncr', name: 'Delhi NCR', state: 'Delhi', hub: true },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', hub: true },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', hub: true },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', hub: false },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', hub: false },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', hub: false },
  { id: 'chandigarh', name: 'Chandigarh', state: 'Punjab', hub: false },
];

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  currentCity: string;
  onSelectCity: (city: string) => void;
  title?: string;
  subtitle?: string;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  onClose,
  currentCity,
  onSelectCity,
  title = 'Select Service Location',
  subtitle = 'Choose your city to discover available services & partners',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  const filteredCities = POPULAR_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDetectLocation = async () => {
    setIsDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Please allow location access to auto-detect your current city.'
        );
        setIsDetecting(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let detectedCity = '';
      if (Platform.OS === 'web') {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          if (res.ok) {
            const data = await res.json();
            detectedCity =
              data?.address?.city ||
              data?.address?.town ||
              data?.address?.suburb ||
              data?.address?.state_district ||
              '';
          }
        } catch {
          // ignore
        }
      } else {
        const rev = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (rev && rev.length > 0) {
          detectedCity = rev[0].city || rev[0].subregion || rev[0].region || '';
        }
      }

      if (detectedCity) {
        // Look for matching known city or use clean detected name
        const match = POPULAR_CITIES.find(
          (c) =>
            c.name.toLowerCase() === detectedCity.toLowerCase() ||
            detectedCity.toLowerCase().includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(detectedCity.toLowerCase())
        );
        const finalCityName = match ? match.name : detectedCity;
        onSelectCity(finalCityName);
        onClose();
      } else {
        Alert.alert(
          'Location Detected',
          'Could not find a specific city name from GPS. Please select your city from the list.'
        );
      }
    } catch (e: any) {
      Alert.alert(
        'GPS Detection Failed',
        'Could not determine location. Please select your city manually.'
      );
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCityPick = (name: string) => {
    onSelectCity(name);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="flex-1"
        />

        <View className="bg-white rounded-t-[32px] pt-3 pb-8 px-5 max-h-[85%] shadow-2xl border-t border-slate-100">
          {/* Top handle pill */}
          <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mb-4" />

          {/* Header */}
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-black text-slate-900 tracking-tight">
                {title}
              </Text>
              <Text className="text-xs text-slate-500 font-medium mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            >
              <Ionicons name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* GPS Auto-Detect Button */}
          <TouchableOpacity
            onPress={handleDetectLocation}
            disabled={isDetecting}
            activeOpacity={0.85}
            className="mt-4 mb-3 p-3.5 rounded-2xl bg-purple-50 border border-purple-200 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-purple-600 items-center justify-center shadow-sm">
                {isDetecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
                )}
              </View>
              <View>
                <Text className="text-sm font-extrabold text-purple-950">
                  {isDetecting ? 'Detecting Location...' : 'Use Current Location'}
                </Text>
                <Text className="text-[11px] text-purple-600 font-semibold mt-0.5">
                  GPS Auto-detect via Device Sensor
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
          </TouchableOpacity>

          {/* Search Input */}
          <View className="flex-row items-center bg-slate-100 rounded-2xl px-3.5 py-2.5 mb-3 border border-slate-200">
            <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search city or state..."
              placeholderTextColor="#94A3B8"
              className="flex-1 text-sm font-semibold text-slate-800 p-0"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* City Selection List */}
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              {searchQuery ? 'Search Results' : 'Supported Cities'}
            </Text>
            <Text className="text-[11px] font-bold text-slate-400">
              {filteredCities.length} Cities
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            className="max-h-[300px]"
            keyboardShouldPersistTaps="handled"
          >
            {filteredCities.length > 0 ? (
              <View className="space-y-1.5 gap-y-1.5 pb-2">
                {filteredCities.map((city) => {
                  const isSelected =
                    currentCity.toLowerCase() === city.name.toLowerCase();

                  return (
                    <TouchableOpacity
                      key={city.id}
                      onPress={() => handleCityPick(city.name)}
                      activeOpacity={0.7}
                      className={`flex-row items-center justify-between p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-purple-50/80 border-purple-500 shadow-sm'
                          : 'bg-white border-slate-100 active:bg-slate-50'
                      }`}
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className={`w-8 h-8 rounded-xl items-center justify-center ${
                            isSelected ? 'bg-purple-600' : 'bg-slate-100'
                          }`}
                        >
                          <Ionicons
                            name="location"
                            size={16}
                            color={isSelected ? '#FFFFFF' : '#64748B'}
                          />
                        </View>
                        <View>
                          <View className="flex-row items-center gap-2">
                            <Text
                              className={`text-sm font-black ${
                                isSelected ? 'text-purple-900' : 'text-slate-800'
                              }`}
                            >
                              {city.name}
                            </Text>
                            {city.hub && (
                              <View className="bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                <Text className="text-[9px] font-black text-emerald-700 uppercase">
                                  Live Hub
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-[11px] font-semibold text-slate-400 mt-0.5">
                            {city.state}
                          </Text>
                        </View>
                      </View>

                      {isSelected ? (
                        <View className="w-6 h-6 rounded-full bg-purple-600 items-center justify-center">
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="py-8 items-center justify-center">
                <Ionicons name="location-outline" size={32} color="#CBD5E1" />
                <Text className="text-sm font-bold text-slate-500 mt-2">
                  No cities found for "{searchQuery}"
                </Text>
                <TouchableOpacity
                  onPress={() => handleCityPick(searchQuery.trim())}
                  className="mt-3 px-4 py-2 rounded-xl bg-purple-600 active:bg-purple-700"
                >
                  <Text className="text-xs font-bold text-white">
                    Use "{searchQuery.trim()}" as custom location
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
