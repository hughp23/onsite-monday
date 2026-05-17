import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Modal, Pressable, Text, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import SubscriptionCard from '@/components/SubscriptionCard';
import { subscriptionService } from '@/src/services/subscriptionService';
import { colors } from '@/constants/colors';
import { SubscriptionTier } from '@/constants/types';

const TIER_NAMES: Record<SubscriptionTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export default function SubscriptionScreen() {
  const { currentUser, updateSubscription } = useApp();
  const insets = useSafeAreaInsets();
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!currentUser) return null;

  // Load subscription active state and handle deep link returns from Stripe Checkout
  useEffect(() => {
    subscriptionService.getCurrent().then(sub => setIsSubscriptionActive(sub.isActive)).catch(() => {});

    const handleUrl = ({ url }: { url: string }) => {
      if (url === 'onsitemonday://subscription/success') {
        subscriptionService.getCurrent()
          .then(sub => setIsSubscriptionActive(sub.isActive))
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

  const isExistingSubscriber = isSubscriptionActive;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Choose the plan that's right for your business. Upgrade anytime.
        </Text>
        {(['bronze', 'silver', 'gold'] as SubscriptionTier[]).map(tier => (
          <SubscriptionCard
            key={tier}
            tier={tier}
            isCurrentPlan={currentUser.subscription === tier}
            onSelect={() => handleSelect(tier)}
          />
        ))}
        <Text style={styles.note}>
          All plans include access to the Onsite Monday jobs board, in-app messaging, and profile listing.
          Cancel anytime.
        </Text>
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 16 },
  subtitle: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  note: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },
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
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: colors.textLight, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
