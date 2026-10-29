import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProfileCompletionResult } from '@volo/shared-types';

interface PersistentGuidanceBannerProps {
  completion: ProfileCompletionResult;
  role: 'customer' | 'worker';
  onDismiss?: () => void;
}

export function PersistentGuidanceBanner({
  completion,
  role,
  onDismiss,
}: PersistentGuidanceBannerProps) {
  const router = useRouter();

  // If already 100% complete, banner automatically disappears!
  if (completion.isComplete || completion.percentage >= 100) {
    return null;
  }

  const handleContinue = () => {
    if (completion.nextRoute) {
      if (role === 'customer') {
        if (completion.nextRoute.includes('addresses')) {
          router.push('/(customer)/profile/addresses' as any);
        } else {
          router.push('/(customer)/profile/edit' as any);
        }
      } else {
        if (completion.nextRoute.includes('kyc')) {
          router.push('/(worker)/kyc' as any);
        } else if (completion.nextRoute.includes('payouts') || completion.nextRoute.includes('bank')) {
          router.push('/(worker)/profile' as any);
        } else {
          router.push('/(worker)/profile' as any);
        }
      }
    } else {
      router.push(role === 'customer' ? ('/(customer)/profile' as any) : ('/(worker)/profile' as any));
    }
  };

  const isCaptain = role === 'worker';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.iconBadge}>
          <Ionicons name="shield-checkmark" size={18} color="#D97706" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isCaptain ? "Complete Captain Profile" : "Complete Your Profile"}
          </Text>
          <Text style={styles.subtitle}>
            {isCaptain
              ? "Add your details and verification to start receiving high-paying jobs."
              : "Complete your account to enable fast doorstep service bookings."}
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>
            {completion.completedItems.length} of {completion.items.filter((i) => i.isMandatory).length} required completed
          </Text>
          <Text style={styles.percentageText}>{completion.percentage}%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${Math.max(8, completion.percentage)}%` }]} />
        </View>
      </View>

      {/* Next Required Item */}
      {completion.nextStep && (
        <View style={styles.nextStepRow}>
          <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
          <Text style={styles.nextStepText} numberOfLines={1}>
            Next: {completion.nextStep}
          </Text>
        </View>
      )}

      {/* Action Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Continue Setup</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
  progressSection: {
    marginTop: 12,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  percentageText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 3,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  nextStepText: {
    fontSize: 12,
    color: '#FCD34D',
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
