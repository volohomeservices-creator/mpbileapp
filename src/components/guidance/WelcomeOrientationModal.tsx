import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface WelcomeOrientationModalProps {
  visible: boolean;
  userName?: string | null;
  role: 'customer' | 'worker';
  onGetStarted: () => void;
  onExploreOnMyOwn: () => void;
}

export function WelcomeOrientationModal({
  visible,
  userName,
  role,
  onGetStarted,
  onExploreOnMyOwn,
}: WelcomeOrientationModalProps) {
  const isCaptain = role === 'worker';
  const firstName = userName ? userName.split(' ')[0] : (isCaptain ? 'Captain' : 'Customer');

  const customerHighlights = [
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Book Trusted Home Services',
      desc: 'Transparent pricing for plumbing, electrical, cleaning, and more.',
    },
    {
      icon: 'calendar-outline' as const,
      title: 'Flexible Scheduling',
      desc: 'Choose Instant service or select a future time slot that suits you.',
    },
    {
      icon: 'navigate-outline' as const,
      title: 'Live Tracking & Safety',
      desc: 'Follow your assigned Captain live on the map with secure OTP verification.',
    },
    {
      icon: 'wallet-outline' as const,
      title: 'Easy Payments & Invoices',
      desc: 'Pay online or Cash on Delivery with instant digital tax invoices.',
    },
  ];

  const captainHighlights = [
    {
      icon: 'flash-outline' as const,
      title: 'Instant Job Alerts',
      desc: 'Toggle Online duty to receive nearby booking requests in real time.',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Verified Captain Workspace',
      desc: 'Manage your documents, service categories, and professional profile.',
    },
    {
      icon: 'navigate-outline' as const,
      title: 'Turn-by-Turn Navigation',
      desc: 'Easy route guidance straight to the customer doorstep.',
    },
    {
      icon: 'cash-outline' as const,
      title: 'Guaranteed Payouts',
      desc: 'Earn per completed service with prompt bank transfers and incentives.',
    },
  ];

  const highlights = isCaptain ? captainHighlights : customerHighlights;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onExploreOnMyOwn}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            style={styles.gradientCard}
          >
            {/* VOLO Logo / Icon */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="home" size={22} color="#0284C7" />
              </View>
              <Text style={styles.brandTitle}>VOLO HOME SERVICES</Text>
            </View>

            {/* Greeting */}
            <Text style={styles.greeting}>
              Welcome, {firstName}!
            </Text>
            <Text style={styles.roleTag}>
              {isCaptain ? 'Service Captain Workspace' : 'Customer Account'}
            </Text>

            <Text style={styles.introText}>
              {isCaptain
                ? 'Manage your professional profile, receive service assignments, update job progress, and track your earnings from one place.'
                : 'Book trusted home services, choose a convenient time, track your service, and manage your bookings from one place.'}
            </Text>

            {/* Highlights List */}
            <ScrollView style={styles.highlightsList} showsVerticalScrollIndicator={false}>
              {highlights.map((item, idx) => (
                <View key={idx} style={styles.highlightItem}>
                  <View style={styles.itemIconBadge}>
                    <Ionicons name={item.icon} size={18} color="#38BDF8" />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onGetStarted}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Let's Get Started</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onExploreOnMyOwn}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Explore on My Own</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  gradientCard: {
    padding: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  roleTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 10,
  },
  introText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 16,
  },
  highlightsList: {
    maxHeight: 220,
    marginBottom: 20,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  actionSection: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
