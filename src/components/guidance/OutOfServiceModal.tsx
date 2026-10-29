import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OutOfServiceModalProps {
  visible: boolean;
  onClose: () => void;
  detectedCity?: string;
  onSelectWarangal?: () => void;
}

export default function OutOfServiceModal({
  visible,
  onClose,
  detectedCity,
  onSelectWarangal,
}: OutOfServiceModalProps) {
  const [notifyInput, setNotifyInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const cityName = detectedCity || 'your area';

  const handleNotify = () => {
    if (notifyInput.trim()) {
      setSubmitted(true);
      Alert.alert('Thank You', `We will notify you as soon as VOLO launches in ${cityName}!`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="location-outline" size={24} color="#45016E" />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Title & Badge */}
          <View style={styles.body}>
            <View style={styles.cityBadge}>
              <Ionicons name="location-sharp" size={12} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={styles.cityBadgeText}>Currently in Warangal Only</Text>
            </View>

            <Text style={styles.title}>
              We are not serving in {cityName} yet
            </Text>

            <Text style={styles.description}>
              VOLO operates exclusively within a <Text style={{ fontWeight: '800', color: '#1E1535' }}>30 km radius of Warangal</Text> (including Hanamkonda & Kazipet) to guarantee 15-minute dispatch times.
            </Text>

            {/* Remote booking tip */}
            <View style={styles.tipBox}>
              <Ionicons name="home-outline" size={16} color="#45016E" style={{ marginRight: 8, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>Booking for family in Warangal?</Text>
                <Text style={styles.tipDesc}>
                  You can order from Hyderabad or anywhere across India as long as the service location is in Warangal.
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            {onSelectWarangal && (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onSelectWarangal();
                }}
                style={styles.actionBtn}
              >
                <Ionicons name="compass" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Pin / Choose Warangal Address</Text>
              </TouchableOpacity>
            )}

            {/* Notify me form */}
            {!submitted ? (
              <View style={styles.notifyRow}>
                <TextInput
                  value={notifyInput}
                  onChangeText={setNotifyInput}
                  placeholder="Enter phone or email for launch alerts"
                  placeholderTextColor="#94A3B8"
                  style={styles.notifyInput}
                />
                <TouchableOpacity onPress={handleNotify} style={styles.notifyBtn}>
                  <Text style={styles.notifyBtnText}>Notify Me</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.submittedBox}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.submittedText}>You'll be the first to know when we expand here!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#45016E',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  cityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E1535',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  tipTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#45016E',
  },
  tipDesc: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  actionBtn: {
    height: 44,
    backgroundColor: '#45016E',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  notifyInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 11,
    color: '#1E293B',
  },
  notifyBtn: {
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  submittedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 10,
  },
  submittedText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
  },
});
