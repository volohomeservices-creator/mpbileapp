import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GuideStep } from '@volo/shared-types';

interface InteractiveFeatureTourProps {
  visible: boolean;
  step: GuideStep | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  tourTitle?: string;
}

export function InteractiveFeatureTour({
  visible,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  tourTitle,
}: InteractiveFeatureTourProps) {
  if (!visible || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                Step {stepIndex + 1} of {totalSteps}
              </Text>
            </View>
            {tourTitle && (
              <Text style={styles.tourTitle} numberOfLines={1}>
                {tourTitle}
              </Text>
            )}
            <TouchableOpacity
              onPress={onSkip}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Progress Indicator Dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === stepIndex && styles.activeDot,
                  idx < stepIndex && styles.completedDot,
                ]}
              />
            ))}
          </View>

          {/* Content */}
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepDescription}>{step.description}</Text>

          {/* Navigation Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={onSkip}
              style={styles.skipButton}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip Tour</Text>
            </TouchableOpacity>

            <View style={styles.actionButtonsRow}>
              {!isFirst && (
                <TouchableOpacity
                  onPress={onPrev}
                  style={styles.navButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={18} color="#CBD5E1" />
                  <Text style={styles.navButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onNext}
                style={styles.primaryNavButton}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryNavText}>
                  {isLast ? (step.actionText || 'Finish') : (step.actionText || 'Next')}
                </Text>
                {!isLast && (
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />
                )}
                {isLast && (
                  <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  tourTitle: {
    flex: 1,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginHorizontal: 8,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
  },
  dot: {
    height: 4,
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 2,
  },
  activeDot: {
    backgroundColor: '#0284C7',
    height: 4,
  },
  completedDot: {
    backgroundColor: '#0369A1',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  primaryNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0284C7',
  },
  primaryNavText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
