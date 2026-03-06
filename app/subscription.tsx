import React, { useState } from 'react';
import {
  View, ScrollView, StyleSheet, Modal, Pressable, Text, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import SubscriptionCard from '@/components/SubscriptionCard';
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
  const [successTier, setSuccessTier] = useState<SubscriptionTier | null>(null);

  const handleSelect = (tier: SubscriptionTier) => {
    if (tier !== currentUser.subscription) {
      setConfirmTier(tier);
    }
  };

  const confirmChange = () => {
    if (confirmTier) {
      updateSubscription(confirmTier);
      setSuccessTier(confirmTier);
      setConfirmTier(null);
    }
  };

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
          All plans include access to the Ônsite Monday jobs board, in-app messaging, and profile listing.
          Cancel anytime.
        </Text>
      </ScrollView>

      {/* Confirmation modal */}
      <Modal visible={!!confirmTier} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setConfirmTier(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="crown" size={44} color={colors.accent} />
            <Text style={styles.modalTitle}>Switch to {confirmTier ? TIER_NAMES[confirmTier] : ''}?</Text>
            <Text style={styles.modalDesc}>
              Your plan will be updated immediately. You can change it again at any time.
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmChange}>
              <Text style={styles.confirmBtnText}>Yes, Switch Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmTier(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Success modal */}
      <Modal visible={!!successTier} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setSuccessTier(null); router.back(); }}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="check-circle" size={56} color={colors.success} />
            <Text style={styles.modalTitle}>Plan Updated!</Text>
            <Text style={styles.modalDesc}>
              You're now on the {successTier ? TIER_NAMES[successTier] : ''} plan.
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => { setSuccessTier(null); router.back(); }}>
              <Text style={styles.confirmBtnText}>Great!</Text>
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
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: colors.textLight, fontSize: 14 },
});
