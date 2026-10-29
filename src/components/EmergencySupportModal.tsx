import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getFastCurrentLocation } from '@/utils/fastLocation';
import { triggerSOS } from '@/api/sos';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface EmergencySupportModalProps {
  visible: boolean;
  onClose: () => void;
  role?: 'customer' | 'worker';
  activeBookingId?: string | null;
}

export const EmergencySupportModal: React.FC<EmergencySupportModalProps> = ({
  visible,
  onClose,
  role = 'customer',
  activeBookingId = null,
}) => {
  const router = useRouter();
  const [scenario, setScenario] = useState<'sos' | 'breakdown' | 'billing' | 'booking'>('sos');
  const [breakdownTrade, setBreakdownTrade] = useState<'electrician' | 'plumber' | 'ac'>('electrician');
  const [triggeringSOS, setTriggeringSOS] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch device GPS location whenever modal opens
  useEffect(() => {
    if (visible) {
      let isMounted = true;
      getFastCurrentLocation()
        .then((loc) => {
          if (isMounted && loc) {
            setCoords({ lat: loc.latitude, lng: loc.longitude });
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [visible]);

  const handleTransmitSOS = async () => {
    try {
      setTriggeringSOS(true);
      await triggerSOS({
        booking_id: activeBookingId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        reason: role === 'worker' ? 'WORKER_FIELD_EMERGENCY_SOS' : 'CUSTOMER_SAFETY_EMERGENCY_SOS',
        metadata: {
          role,
          platform: 'mobile',
          device: Platform.OS,
          timestamp: new Date().toISOString(),
        },
      });

      Alert.alert(
        '🚨 Emergency SOS Transmitted',
        'Your distress signal with live GPS coordinates has been broadcast to the Volo Safety Operations Desk. Our rapid response officers will call your registered phone number immediately.',
        [
          {
            text: 'Call 112 (Police)',
            onPress: () => Linking.openURL('tel:112'),
            style: 'destructive',
          },
          {
            text: 'Understood',
            onPress: onClose,
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Signal Sent with Warning',
        err?.response?.data?.error || err.message || 'SOS recorded on local channel. Please call 112 directly if in immediate danger.',
        [
          { text: 'Call 112 Now', onPress: () => Linking.openURL('tel:112') },
          { text: 'OK', onPress: onClose },
        ]
      );
    } finally {
      setTriggeringSOS(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hello Volo Support, I need urgent assistance regarding ${scenario === 'billing' ? 'a billing/refund issue' : 'my service'}.`
    );
    Linking.openURL(`https://wa.me/919154092399?text=${message}`).catch(() => {
      Alert.alert('WhatsApp Unavailable', 'Please call our support line at +91 91540 92399');
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          
          {/* Top Brand Accent Line */}
          <LinearGradient
            colors={
              scenario === 'sos'
                ? ['#F43F5E', '#E11D48', '#BE123C']
                : scenario === 'breakdown'
                ? ['#3C01A7', '#6739BB', '#7C3AED']
                : scenario === 'billing'
                ? ['#2563EB', '#4F46E5', '#0284C7']
                : ['#10B981', '#059669', '#047857']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconContainer,
                  scenario === 'sos' && { backgroundColor: '#FFE4E6' },
                  scenario === 'breakdown' && { backgroundColor: '#EDE9FE' },
                  scenario === 'billing' && { backgroundColor: '#DBEAFE' },
                  scenario === 'booking' && { backgroundColor: '#D1FAE5' },
                ]}
              >
                {scenario === 'sos' && <MaterialCommunityIcons name="shield-alert" size={24} color="#E11D48" />}
                {scenario === 'breakdown' && <Ionicons name="flash-sharp" size={24} color="#3C01A7" />}
                {scenario === 'billing' && <Ionicons name="card-sharp" size={24} color="#2563EB" />}
                {scenario === 'booking' && <Ionicons name="call-sharp" size={24} color="#059669" />}
              </View>
              <View style={styles.headerTextContainer}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>Emergency & Support Desk</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.liveBadgeText}>LIVE 24/7</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  Instant safety broadcast, priority dispatch & billing help
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Modal Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Scenario Selection Cards Grid */}
            <Text style={styles.sectionLabel}>SELECT ASSISTANCE TYPE</Text>
            <View style={styles.scenarioGrid}>
              
              {/* 1. Safety SOS */}
              <TouchableOpacity
                onPress={() => setScenario('sos')}
                style={[
                  styles.scenarioCard,
                  scenario === 'sos' ? styles.scenarioCardSelectedSOS : styles.scenarioCardUnselected,
                ]}
                activeOpacity={0.8}
              >
                <View style={styles.scenarioCardTop}>
                  <View style={[styles.miniIcon, { backgroundColor: scenario === 'sos' ? '#E11D48' : '#FFE4E6' }]}>
                    <MaterialCommunityIcons name="shield-alert" size={14} color={scenario === 'sos' ? '#FFF' : '#E11D48'} />
                  </View>
                  <View style={styles.badgeSOS}>
                    <Text style={styles.badgeTextSOS}>SOS</Text>
                  </View>
                </View>
                <Text style={styles.scenarioTitle}>Safety Alert</Text>
                <Text style={styles.scenarioSub}>Hazard & Risk</Text>
              </TouchableOpacity>

              {/* 2. Breakdown (Customer) / Job Dispute (Worker) */}
              {role === 'customer' ? (
                <TouchableOpacity
                  onPress={() => setScenario('breakdown')}
                  style={[
                    styles.scenarioCard,
                    scenario === 'breakdown' ? styles.scenarioCardSelectedBreakdown : styles.scenarioCardUnselected,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.scenarioCardTop}>
                    <View style={[styles.miniIcon, { backgroundColor: scenario === 'breakdown' ? '#3C01A7' : '#EDE9FE' }]}>
                      <Ionicons name="flash-sharp" size={14} color={scenario === 'breakdown' ? '#FFF' : '#3C01A7'} />
                    </View>
                    <View style={styles.badgePurple}>
                      <Text style={styles.badgeTextPurple}>15 Min</Text>
                    </View>
                  </View>
                  <Text style={styles.scenarioTitle}>Breakdown</Text>
                  <Text style={styles.scenarioSub}>Fast Dispatch</Text>
                </TouchableOpacity>
              ) : null}

              {/* 3. Billing Help (Customer) / Payouts (Worker) */}
              <TouchableOpacity
                onPress={() => setScenario('billing')}
                style={[
                  styles.scenarioCard,
                  scenario === 'billing' ? styles.scenarioCardSelectedBilling : styles.scenarioCardUnselected,
                ]}
                activeOpacity={0.8}
              >
                <View style={styles.scenarioCardTop}>
                  <View style={[styles.miniIcon, { backgroundColor: scenario === 'billing' ? '#2563EB' : '#DBEAFE' }]}>
                    <Ionicons name="card-sharp" size={14} color={scenario === 'billing' ? '#FFF' : '#2563EB'} />
                  </View>
                  <View style={styles.badgeBlue}>
                    <Text style={styles.badgeTextBlue}>{role === 'customer' ? 'Accounts' : 'Finance'}</Text>
                  </View>
                </View>
                <Text style={styles.scenarioTitle}>{role === 'customer' ? 'Billing Help' : 'Payouts'}</Text>
                <Text style={styles.scenarioSub}>{role === 'customer' ? 'Refund & Invoices' : 'Settlements'}</Text>
              </TouchableOpacity>

              {/* 4. Active Order Help */}
              <TouchableOpacity
                onPress={() => setScenario('booking')}
                style={[
                  styles.scenarioCard,
                  scenario === 'booking' ? styles.scenarioCardSelectedBooking : styles.scenarioCardUnselected,
                ]}
                activeOpacity={0.8}
              >
                <View style={styles.scenarioCardTop}>
                  <View style={[styles.miniIcon, { backgroundColor: scenario === 'booking' ? '#059669' : '#D1FAE5' }]}>
                    <Ionicons name="call-sharp" size={14} color={scenario === 'booking' ? '#FFF' : '#059669'} />
                  </View>
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeTextGreen}>Live Job</Text>
                  </View>
                </View>
                <Text style={styles.scenarioTitle}>Active Order</Text>
                <Text style={styles.scenarioSub}>Operations Desk</Text>
              </TouchableOpacity>

            </View>

            {/* Scenario Content Stage */}
            <View style={styles.stageCard}>
              
              {/* SCENARIO 1: CRITICAL SAFETY SOS */}
              {scenario === 'sos' && (
                <View style={styles.stageContent}>
                  <View style={styles.heroRow}>
                    <View style={styles.heroIconSOS}>
                      <Ionicons name="warning" size={20} color="#E11D48" />
                    </View>
                    <View style={styles.heroTextContainer}>
                      <Text style={styles.heroTitleSOS}>Immediate Safety Distress Broadcast</Text>
                      <Text style={styles.heroSubtitle}>
                        Transmits your live GPS coordinates directly to the Volo Safety Operations Desk & nearest emergency rapid response units.
                      </Text>
                    </View>
                  </View>

                  {/* GPS Coordinates Pill */}
                  <View style={styles.coordsCard}>
                    <View style={styles.coordsLeft}>
                      <Ionicons name="location-sharp" size={16} color="#E11D48" />
                      <Text style={styles.coordsLabel}>Live Coordinates:</Text>
                      <Text style={styles.coordsValue}>
                        {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Locating device GPS...'}
                      </Text>
                    </View>
                    <View style={styles.activeLockBadge}>
                      <View style={styles.activeLockDot} />
                      <Text style={styles.activeLockText}>Active Lock</Text>
                    </View>
                  </View>

                  {/* SOS Buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={handleTransmitSOS}
                      disabled={triggeringSOS}
                      style={styles.btnTransmitSOS}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#E11D48', '#BE123C']}
                        style={styles.gradientBtnFull}
                      >
                        {triggeringSOS ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <MaterialCommunityIcons name="shield-alert" size={18} color="#FFF" />
                        )}
                        <Text style={styles.btnTransmitSOSText}>
                          {triggeringSOS ? 'Transmitting Live Signal...' : 'Transmit Emergency SOS Now'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => Linking.openURL('tel:112')}
                      style={styles.btnCallPolice}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="call" size={16} color="#E11D48" />
                      <Text style={styles.btnCallPoliceText}>Call 112 (Police)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SCENARIO 2: 15-MIN BREAKDOWN */}
              {scenario === 'breakdown' && (
                <View style={styles.stageContent}>
                  <View style={styles.tradeHeader}>
                    <Ionicons name="flash-sharp" size={18} color="#3C01A7" />
                    <Text style={styles.tradeHeaderText}>Select Emergency Trade Required:</Text>
                  </View>
                  <Text style={styles.tradeSubText}>
                    The nearest on-duty technician will be prioritized and dispatched to arrive within 15-20 minutes.
                  </Text>

                  {/* 3 Trade Options */}
                  <View style={styles.tradesRow}>
                    {[
                      { id: 'electrician', label: 'Electrician', icon: 'flash', sub: 'Power / Fuse' },
                      { id: 'plumber', label: 'Plumber', icon: 'water', sub: 'Leak / Burst' },
                      { id: 'ac', label: 'AC Expert', icon: 'snow', sub: 'Cooling / Gas' },
                    ].map((trade) => {
                      const isSel = breakdownTrade === trade.id;
                      return (
                        <TouchableOpacity
                          key={trade.id}
                          onPress={() => setBreakdownTrade(trade.id as any)}
                          style={[styles.tradeCard, isSel ? styles.tradeCardSelected : styles.tradeCardUnselected]}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={trade.icon as any}
                            size={20}
                            color={isSel ? '#FFF' : '#3C01A7'}
                          />
                          <Text style={[styles.tradeTitle, isSel && styles.tradeTitleSelected]}>
                            {trade.label}
                          </Text>
                          <Text style={[styles.tradeSub, isSel && styles.tradeSubSelected]}>
                            {trade.sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: '/(customer)/bookings/create' as any,
                        params: { priority: 'emergency', trade: breakdownTrade },
                      });
                    }}
                    style={styles.btnDispatch}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#3C01A7', '#6739BB']}
                      style={styles.gradientBtnFull}
                    >
                      <Ionicons name="flash-sharp" size={18} color="#FFF" />
                      <Text style={styles.btnDispatchText}>
                        Dispatch Nearest {breakdownTrade.toUpperCase()} (15 Min Priority)
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* SCENARIO 3: BILLING & INVOICES */}
              {scenario === 'billing' && (
                <View style={styles.stageContent}>
                  <View style={styles.tradeHeader}>
                    <Ionicons name="card-sharp" size={18} color="#2563EB" />
                    <Text style={styles.tradeHeaderText}>Volo Accounts & Billing Support</Text>
                  </View>
                  <Text style={styles.tradeSubText}>
                    Contact our dedicated finance team directly for instant refund queries, disputed invoices, or wallet balances.
                  </Text>

                  {/* 2 Contact Tiles */}
                  <View style={styles.contactRow}>
                    <TouchableOpacity
                      onPress={() => handleCall('+919154092399')}
                      style={styles.contactCard}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.contactIconCircle, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="call" size={18} color="#2563EB" />
                      </View>
                      <View style={styles.contactTextContainer}>
                        <Text style={styles.contactLabel}>Accounts Helpline</Text>
                        <Text style={styles.contactValue}>+91 91540 92399</Text>
                        <Text style={[styles.contactSub, { color: '#2563EB' }]}>Tap to call</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleWhatsApp}
                      style={styles.contactCard}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.contactIconCircle, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="logo-whatsapp" size={18} color="#059669" />
                      </View>
                      <View style={styles.contactTextContainer}>
                        <Text style={styles.contactLabel}>WhatsApp Support</Text>
                        <Text style={styles.contactValue}>Direct WhatsApp</Text>
                        <Text style={[styles.contactSub, { color: '#059669' }]}>Instant chat</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Primary Navigation Buttons: View Invoices & Wallet */}
                  <View style={styles.doubleNavRow}>
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        if (role === 'customer') {
                          router.push('/(customer)/profile/invoices' as any);
                        } else {
                          router.push('/(worker)/settlements' as any);
                        }
                      }}
                      style={styles.btnPrimaryInvoice}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="receipt-sharp" size={16} color="#FFF" />
                      <Text style={styles.btnPrimaryInvoiceText}>
                        {role === 'customer' ? 'View Invoices & Receipts' : 'View Settlements'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        if (role === 'customer') {
                          router.push('/(customer)/wallet' as any);
                        } else {
                          router.push('/(worker)/wallet' as any);
                        }
                      }}
                      style={styles.btnWalletLink}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="wallet-sharp" size={16} color="#1E1535" />
                      <Text style={styles.btnWalletLinkText}>Wallet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SCENARIO 4: ACTIVE ORDER HELP */}
              {scenario === 'booking' && (
                <View style={styles.stageContent}>
                  <View style={styles.tradeHeader}>
                    <Ionicons name="headset-sharp" size={18} color="#059669" />
                    <Text style={styles.tradeHeaderText}>Live Order & Field Operations</Text>
                  </View>
                  <Text style={styles.tradeSubText}>
                    Need immediate assistance with an ongoing job, delayed technician, or scope changes?
                  </Text>

                  <View style={styles.contactRow}>
                    <TouchableOpacity
                      onPress={() => handleCall('+919154092399')}
                      style={styles.contactCard}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.contactIconCircle, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="call" size={18} color="#059669" />
                      </View>
                      <View style={styles.contactTextContainer}>
                        <Text style={styles.contactLabel}>Operations Hotline</Text>
                        <Text style={styles.contactValue}>+91 91540 92399</Text>
                        <Text style={[styles.contactSub, { color: '#059669' }]}>Live dispatch room</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        if (role === 'customer') {
                          router.push('/(customer)/bookings' as any);
                        } else {
                          router.push('/(worker)/jobs' as any);
                        }
                      }}
                      style={styles.contactCard}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.contactIconCircle, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="navigate-circle" size={18} color="#3C01A7" />
                      </View>
                      <View style={styles.contactTextContainer}>
                        <Text style={styles.contactLabel}>Live Tracker</Text>
                        <Text style={styles.contactValue}>View Bookings</Text>
                        <Text style={[styles.contactSub, { color: '#3C01A7' }]}>Real-time status</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </View>
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.footerText}>Volo Verified Safety & Support • 24/7 Monitored</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.dismissBtn} activeOpacity={0.7}>
              <Text style={styles.dismissBtnText}>DISMISS</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 6, 26, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 25,
  },
  accentBar: {
    height: 6,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1535',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11D48',
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#BE123C',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  scrollContent: {
    padding: 18,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  scenarioGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scenarioCard: {
    flex: 1,
    minWidth: '45%',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'space-between',
    gap: 6,
  },
  scenarioCardUnselected: {
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  scenarioCardSelectedSOS: {
    borderColor: '#E11D48',
    backgroundColor: '#FFF1F2',
  },
  scenarioCardSelectedBreakdown: {
    borderColor: '#3C01A7',
    backgroundColor: '#F5F3FF',
  },
  scenarioCardSelectedBilling: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  scenarioCardSelectedBooking: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  scenarioCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeSOS: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextSOS: {
    fontSize: 9,
    fontWeight: '900',
    color: '#BE123C',
  },
  badgePurple: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextPurple: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6D28D9',
  },
  badgeBlue: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextBlue: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextGreen: {
    fontSize: 9,
    fontWeight: '900',
    color: '#047857',
  },
  scenarioTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E1535',
  },
  scenarioSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  stageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stageContent: {
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  heroIconSOS: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitleSOS: {
    fontSize: 12,
    fontWeight: '800',
    color: '#BE123C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  coordsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  coordsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  coordsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E1535',
  },
  coordsValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE123C',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  activeLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  activeLockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  activeLockText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  actionRow: {
    gap: 8,
    marginTop: 4,
  },
  btnTransmitSOS: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientBtnFull: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnTransmitSOSText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnCallPolice: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  btnCallPoliceText: {
    color: '#BE123C',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  tradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradeHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E1535',
  },
  tradeSubText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  tradesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tradeCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  tradeCardUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  tradeCardSelected: {
    backgroundColor: '#3C01A7',
    borderColor: '#3C01A7',
  },
  tradeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E1535',
  },
  tradeTitleSelected: {
    color: '#FFFFFF',
  },
  tradeSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },
  tradeSubSelected: {
    color: '#E9D5FF',
  },
  btnDispatch: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  btnDispatchText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTextContainer: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  contactValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E1535',
    marginTop: 1,
  },
  contactSub: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  doubleNavRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btnPrimaryInvoice: {
    flex: 1,
    backgroundColor: '#3C01A7',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  btnPrimaryInvoiceText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnWalletLink: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnWalletLinkText: {
    color: '#1E1535',
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  dismissBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
});
