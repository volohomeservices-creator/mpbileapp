import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGuidance } from '@/hooks/useGuidance';
import { useAuth } from '@/hooks/useAuth';

export default function CustomerHelpGuidesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { guides, restartTour, completion } = useGuidance();
  const [expandedId, setExpandedId] = useState<string | null>('customer_welcome_tour');

  const handleRestartTour = () => {
    restartTour('customer_welcome_tour');
    router.replace('/(customer)/home' as any);
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:18001234567').catch(() => {
      Alert.alert('Customer Support', 'Contact us at support@volohomeservices.com or call 1800-123-4567');
    });
  };

  const faqs = [
    {
      q: 'How does doorstep service booking work?',
      a: 'Choose your desired service, pick your home address, choose Instant or a scheduled time slot, and confirm. A verified Captain will be assigned immediately.',
    },
    {
      q: 'When should I share the Start OTP?',
      a: 'Share your 4-digit security OTP with the Captain only after they arrive at your service address.',
    },
    {
      q: 'What payment methods are supported?',
      a: 'VOLO supports online payments via UPI, Credit/Debit cards, Net Banking, and Cash on Delivery (COD).',
    },
    {
      q: 'Can I reschedule or cancel a booking?',
      a: 'Yes, you can manage or reschedule any upcoming booking directly from the "My Bookings" tab before the Captain departs.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & App Guides</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Quick Tour Banner */}
        <View style={styles.tourBanner}>
          <View style={styles.tourBannerText}>
            <Text style={styles.tourBannerTitle}>Interactive App Tour</Text>
            <Text style={styles.tourBannerSub}>
              Restart the step-by-step walkthrough of features, booking flow, and tracking.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestartTour}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.restartButtonText}>Restart Tour</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Readiness Status */}
        <View style={styles.readinessCard}>
          <View style={styles.readinessHeader}>
            <Ionicons
              name={completion.isComplete ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={completion.isComplete ? '#10B981' : '#F59E0B'}
            />
            <Text style={styles.readinessTitle}>
              Profile Status: {completion.percentage}% Complete
            </Text>
          </View>
          <Text style={styles.readinessDesc}>
            {completion.isComplete
              ? 'Your profile is ready! You can book any home service instantly.'
              : `Missing: ${completion.missingItems.join(', ')}`}
          </Text>
          {!completion.isComplete && (
            <TouchableOpacity
              style={styles.finishProfileBtn}
              onPress={() => router.push('/(customer)/profile/addresses' as any)}
            >
              <Text style={styles.finishProfileText}>Complete Profile Now</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feature Guides Section */}
        <Text style={styles.sectionHeader}>Customer Guides</Text>

        {guides.map((guide) => {
          const isExpanded = expandedId === guide.id;
          return (
            <View key={guide.id} style={styles.guideCard}>
              <TouchableOpacity
                style={styles.guideHeader}
                onPress={() => setExpandedId(isExpanded ? null : guide.id)}
                activeOpacity={0.7}
              >
                <View style={styles.guideIcon}>
                  <Ionicons name="book-outline" size={18} color="#0284C7" />
                </View>
                <View style={styles.guideHeaderText}>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideDesc}>{guide.description}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.guideBody}>
                  {guide.steps.map((st, sIdx) => (
                    <View key={st.id} style={styles.stepItem}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{sIdx + 1}</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>{st.title}</Text>
                        <Text style={styles.stepDesc}>{st.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* FAQs */}
        <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
        <View style={styles.faqCard}>
          {faqs.map((faq, idx) => (
            <View key={idx} style={[styles.faqItem, idx > 0 && styles.faqBorder]}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Text style={styles.faqA}>{faq.a}</Text>
            </View>
          ))}
        </View>

        {/* Contact Support */}
        <View style={styles.supportCard}>
          <Ionicons name="headset" size={28} color="#38BDF8" />
          <Text style={styles.supportTitle}>Need Immediate Help?</Text>
          <Text style={styles.supportDesc}>
            Our 24/7 dedicated customer care team is available to help you with active bookings, invoices, or inquiries.
          </Text>
          <TouchableOpacity
            style={styles.supportBtn}
            onPress={handleCallSupport}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.supportBtnText}>Call Customer Care</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tourBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tourBannerText: {
    marginBottom: 12,
  },
  tourBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  tourBannerSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  restartButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  readinessCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  readinessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  readinessTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginLeft: 8,
  },
  readinessDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  finishProfileBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  finishProfileText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 6,
  },
  guideCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  guideIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  guideHeaderText: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  guideDesc: {
    fontSize: 11,
    color: '#94A3B8',
  },
  guideBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  faqCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  faqItem: {
    paddingVertical: 10,
  },
  faqBorder: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  faqQ: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  faqA: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  supportCard: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    marginBottom: 20,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 8,
    marginBottom: 4,
  },
  supportDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  supportBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
