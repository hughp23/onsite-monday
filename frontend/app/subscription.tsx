import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Modal, Pressable, Text, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import SubscriptionCard from '@/components/SubscriptionCard';
import { subscriptionService, SubscriptionDto } from '@/src/services/subscriptionService';
import { colors } from '@/constants/colors';
import { SubscriptionTier } from '@/constants/types';

const TIER_NAMES: Record<SubscriptionTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

const TIER_BADGE_COLORS: Record<SubscriptionTier, string> = {
  bronze: '#CD7F32',
  silver: '#A8A9AD',
  gold: colors.accent,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SubscriptionScreen() {
  const { currentUser, updateSubscription, cancelSubscription } = useApp();
  const insets = useSafeAreaInsets();
  const [currentSub, setCurrentSub] = useState<SubscriptionDto | null>(null);
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!currentUser) return null;

  useEffect(() => {
    subscriptionService.getCurrent()
      .then(sub => setCurrentSub(sub.isActive ? sub : null))
      .catch(() => {});

    const handleUrl = ({ url }: { url: string }) => {
      if (url === 'onsitemonday://subscription/success') {
        subscriptionService.getCurrent()
          .then(sub => setCurrentSub(sub.isActive ? sub : null))
          .catch(() => {});
        Alert.alert('Plan updated', 'Your subscription is now active.');
      } else if (url === 'onsitemonday://subscription/cancel') {
        Alert.alert('Cancelled', 'Your subscription was not changed.');
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  const handleSelect = (tier: SubscriptionTier) => {
    if (tier !== currentUser.subscription) {
      setConfirmTier(tier);
    }
  };

  const confirmUpgradeNow = async () => {
    if (!confirmTier) return;
    setLoading(true);
    try {
      await updateSubscription(confirmTier, false);
      setConfirmTier(null);
      Alert.alert('Plan updated', `You're now on the ${TIER_NAMES[confirmTier]} plan.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update subscription';
      Alert.alert('Subscription error', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmUpdateCard = async () => {
    if (!confirmTier) return;
    setLoading(true);
    try {
      await updateSubscription(confirmTier, true);
      setConfirmTier(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update subscription';
      Alert.alert('Subscription error', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmCancel = async () => {
    setLoading(true);
    try {
      const updated = await cancelSubscription();
      setCurrentSub(updated);
      setShowCancelModal(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to cancel subscription';
      Alert.alert('Cancellation error', msg);
    } finally {
      setLoading(false);
    }
  };

  const isExistingSubscriber = !!(currentSub?.isActive);
  const tier = currentSub?.tier ?? currentUser.subscription;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Current plan summary — shown when actively subscribed */}
        {currentSub?.isActive && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={[styles.tierBadge, { backgroundColor: TIER_BADGE_COLORS[currentSub.tier] }]}>
                <Text style={styles.tierBadgeText}>{TIER_NAMES[currentSub.tier]}</Text>
              </View>
              <Text style={styles.summaryLabel}>Your current plan</Text>
            </View>

            <View style={styles.summaryRow}>
              {currentSub.cancelAtPeriodEnd ? (
                <>
                  <Ionicons name="alert-circle-outline" size={15} color="#D4A843" />
                  <Text style={styles.summaryRowTextAmber}>
                    {currentSub.currentPeriodEnd
                      ? `Cancels on ${formatDate(currentSub.currentPeriodEnd)}`
                      : 'Cancels at end of billing period'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.summaryRowText}>
                    Active since {formatDate(currentSub.startedAt)}
                  </Text>
                </>
              )}
            </View>

            {!currentSub.cancelAtPeriodEnd && (
              <TouchableOpacity onPress={() => setShowCancelModal(true)} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancel subscription</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.subtitle}>
          Choose the plan that's right for your business. Upgrade anytime.
        </Text>

        {(['bronze', 'silver', 'gold'] as SubscriptionTier[]).map(t => (
          <SubscriptionCard
            key={t}
            tier={t}
            isCurrentPlan={currentUser.subscription === t}
            onSelect={() => handleSelect(t)}
          />
        ))}

        <Text style={styles.note}>
          All plans include access to the Onsite Monday jobs board, in-app messaging, and profile listing.
          Cancel anytime.
        </Text>
      </ScrollView>

      {/* Upgrade modal — unchanged */}
      <Modal visible={!!confirmTier} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !loading && setConfirmTier(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="crown" size={44} color={colors.accent} />
            <Text style={styles.modalTitle}>Switch to {confirmTier ? TIER_NAMES[confirmTier] : ''}?</Text>

            {isExistingSubscriber ? (
              <>
                <Text style={styles.modalDesc}>
                  Upgrade now using your card on file — no re-entry needed. Proration is applied to your next invoice.
                </Text>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={confirmUpgradeNow}
                  disabled={loading}
                >
                  <Text style={styles.confirmBtnText}>Upgrade now · card on file</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, loading && styles.btnDisabled]}
                  onPress={confirmUpdateCard}
                  disabled={loading}
                >
                  <Text style={styles.secondaryBtnText}>Update card & upgrade</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  You'll be redirected to complete payment. Your plan activates once payment is confirmed.
                </Text>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={confirmUpdateCard}
                  disabled={loading}
                >
                  <Text style={styles.confirmBtnText}>Yes, Proceed to Payment</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => !loading && setConfirmTier(null)}
              style={styles.cancelBtn}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Cancel subscription modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !loading && setShowCancelModal(false)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="alert-circle-outline" size={44} color="#D4A843" />
            <Text style={styles.modalTitle}>Cancel your subscription?</Text>
            <Text style={styles.modalDesc}>
              Your {TIER_NAMES[tier]} plan stays active until the end of your current billing period.
              After that you'll lose access to the jobs board and paid features.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={() => !loading && setShowCancelModal(false)}
              disabled={loading}
            >
              <Text style={styles.confirmBtnText}>Keep my plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.destructiveBtn, loading && styles.btnDisabled]}
              onPress={confirmCancel}
              disabled={loading}
            >
              <Text style={styles.destructiveBtnText}>Yes, cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 16 },

  // Current plan summary card
  summaryCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tierBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textLight,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  summaryRowText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryRowTextAmber: {
    fontSize: 13,
    color: '#D4A843',
    fontWeight: '600',
  },
  cancelLink: {
    alignSelf: 'flex-start',
  },
  cancelLinkText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },

  subtitle: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  note: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  destructiveBtn: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  destructiveBtnText: { color: colors.error, fontWeight: '600', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: colors.textLight, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
