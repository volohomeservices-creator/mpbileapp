import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator, BackHandler } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getWorkerAvailability, updateWorkerAvailability, WorkerAvailability } from '@/api/profile';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export default function WorkerAvailabilityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(worker)/profile');
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

  // Query to fetch availability parameters
  const { data: availData, isLoading, isError, refetch } = useQuery({
    queryKey: ['worker-availability'],
    queryFn: getWorkerAvailability,
  });

  // State hook bindings
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [vacationMode, setVacationMode] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');

  // Sync state with fetched parameters
  useEffect(() => {
    if (availData) {
      setWorkingDays(availData.working_days || []);
      setStartTime((availData.start_time || '09:00:00').substring(0, 5));
      setEndTime((availData.end_time || '18:00:00').substring(0, 5));
      setVacationMode(!!availData.vacation_mode);
      setUnavailableDates(availData.unavailable_dates || []);
    }
  }, [availData]);

  // Toggle single weekday selection
  const handleToggleDay = (day: string) => {
    if (vacationMode) return;
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Add a specific date off
  const handleAddDate = () => {
    const trimmed = newDateInput.trim();
    if (!trimmed) return;

    // Validate YYYY-MM-DD pattern
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(trimmed)) {
      Alert.alert('Invalid Format', 'Please enter date in YYYY-MM-DD format (e.g., 2026-07-15).');
      return;
    }

    if (unavailableDates.includes(trimmed)) {
      Alert.alert('Duplicate Date', 'This date is already listed as unavailable.');
      return;
    }

    setUnavailableDates((prev) => [...prev, trimmed].sort());
    setNewDateInput('');
  };

  // Remove a date off
  const handleRemoveDate = (date: string) => {
    setUnavailableDates((prev) => prev.filter((d) => d !== date));
  };

  // Save parameters mutation
  const saveMutation = useMutation({
    mutationFn: updateWorkerAvailability,
    onSuccess: () => {
      Alert.alert('Saved', 'Availability settings updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['worker-availability'] });
      queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
      handleBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to save availability settings.');
    },
  });

  const handleSave = () => {
    if (!vacationMode && workingDays.length === 0) {
      Alert.alert('Select Workdays', 'Please select at least one working weekday or turn on Vacation Mode.');
      return;
    }

    const payload: WorkerAvailability = {
      working_days: workingDays,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      vacation_mode: vacationMode,
      unavailable_dates: unavailableDates,
    };

    saveMutation.mutate(payload);
  };

  return (
    <SafeAreaView className="flex-1 bg-background-secondary">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-border-primary bg-white shadow-sm">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
        >
          <Ionicons name="arrow-back" size={18} color="rgb(var(--text-secondary))" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-extrabold flex-1">My Availability</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="rgb(var(--brand-orange))" />
          <Text className="text-text-secondary text-xs mt-2 font-semibold">Loading shift parameters…</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="rgb(var(--danger))" />
          <Text className="text-text-primary font-bold mt-4">Unable to Load Availability</Text>
          <Button label="Retry" variant="primary" onPress={() => refetch()} className="mt-4" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* Vacation Mode Card */}
          <View className="mb-5">
            <Card variant="default" className="p-5">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-1 pr-4">
                  <Text className="text-text-primary text-base font-extrabold">Vacation Mode</Text>
                  <Text className="text-text-secondary text-[10px] font-semibold mt-0.5 leading-snug">
                    Toggle on to temporarily set status offline and block new customer assignments.
                  </Text>
                </View>
                <Switch
                  value={vacationMode}
                  onValueChange={setVacationMode}
                  trackColor={{ false: '#cbd5e1', true: 'rgba(var(--brand-orange) / 0.2)' }}
                  thumbColor={vacationMode ? 'rgb(var(--brand-orange))' : '#94a3b8'}
                />
              </View>
              {vacationMode && (
                <View className="bg-warning/5 border border-warning/15 rounded-2xl p-3 mt-1 flex-row items-center">
                  <Ionicons name="warning-outline" size={16} color="rgb(var(--warning))" className="mr-2" />
                  <Text className="text-warning text-[10px] font-bold flex-1 leading-snug">
                    Weekly workday scheduling is disabled while Vacation Mode is active.
                  </Text>
                </View>
              )}
            </Card>
          </View>

          {/* Shift Schedule Parameters */}
          <View className="mb-5">
            <Card variant="default" className={`p-5 ${vacationMode ? 'opacity-50' : ''}`}>
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-4">Weekly Schedule</Text>

              {/* Weekdays Multi-Select */}
              <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider mb-2.5">Select Working Days</Text>
              <View className="flex-row flex-wrap gap-2 mb-5">
                {WEEKDAYS.map((day) => {
                  const isSelected = workingDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      disabled={vacationMode}
                      onPress={() => handleToggleDay(day)}
                      activeOpacity={0.8}
                      className={`px-3.5 py-2 rounded-xl border ${
                        isSelected
                          ? 'bg-brand-orange/10 border-brand-orange/20'
                          : 'bg-white border-border-secondary'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${
                        isSelected ? 'text-brand-orange' : 'text-text-secondary'
                      }`}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Timings */}
              <View className="flex-row justify-between">
                <View className="w-[47%]">
                  <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1.5">Shift Starts</Text>
                  <TextInput
                    value={startTime}
                    editable={!vacationMode}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    placeholderTextColor="rgb(var(--text-muted))"
                    maxLength={5}
                    className="bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-xs font-bold text-center focus:bg-background-card focus:border-primary"
                  />
                </View>
                <View className="w-[47%]">
                  <Text className="text-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1.5">Shift Ends</Text>
                  <TextInput
                    value={endTime}
                    editable={!vacationMode}
                    onChangeText={setEndTime}
                    placeholder="18:00"
                    placeholderTextColor="rgb(var(--text-muted))"
                    maxLength={5}
                    className="bg-background-secondary border border-border-secondary rounded-xl p-3 text-text-primary text-xs font-bold text-center focus:bg-background-card focus:border-primary"
                  />
                </View>
              </View>
            </Card>
          </View>

          {/* Specific Unavailable Dates */}
          <View className="mb-6">
            <Card variant="default" className="p-5">
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-2">Specific Days Off</Text>
              <Text className="text-text-secondary text-[10px] font-medium leading-snug mb-4">
                Add individual dates (e.g. holidays) when you are not available for booking.
              </Text>

              {/* Input field */}
              <View className="flex-row gap-2 mb-4">
                <TextInput
                  value={newDateInput}
                  onChangeText={setNewDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgb(var(--text-muted))"
                  maxLength={10}
                  className="flex-1 bg-background-secondary border border-border-secondary rounded-xl px-4 py-2.5 text-text-primary text-xs font-bold h-11 focus:bg-background-card focus:border-primary"
                />
                <TouchableOpacity
                  onPress={handleAddDate}
                  activeOpacity={0.8}
                  className="bg-brand-orange w-11 h-11 rounded-xl items-center justify-center active:bg-orange-600 shadow-sm"
                >
                  <Ionicons name="add" size={20} color="white" />
                </TouchableOpacity>
              </View>

              {/* Selected dates list */}
              {unavailableDates.length === 0 ? (
                <Text className="text-text-muted text-[10px] font-bold text-center italic py-2">
                  No specific days off added.
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2 pt-1">
                  {unavailableDates.map((date) => (
                    <View
                      key={date}
                      className="flex-row items-center bg-background-secondary border border-border-secondary rounded-xl px-3 py-1.5"
                    >
                      <Text className="text-text-primary text-xs font-extrabold mr-1.5">{date}</Text>
                      <TouchableOpacity onPress={() => handleRemoveDate(date)} activeOpacity={0.8} className="p-0.5">
                        <Ionicons name="close-circle" size={14} color="rgb(var(--text-muted))" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>

          {/* Save Button */}
          <Button
            label="Save Schedule"
            variant="brand"
            disabled={saveMutation.isPending}
            loading={saveMutation.isPending}
            size="lg"
            onPress={handleSave}
            className="w-full"
          />

        </ScrollView>
      )}
    </SafeAreaView>
  );
}
