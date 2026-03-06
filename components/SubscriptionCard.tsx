import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionTier } from '@/constants/types';
import { colors } from '@/constants/colors';

interface SubscriptionCardProps {
  tier: SubscriptionTier;
  isCurrentPlan: boolean;
  onSelect: () => void;
}

const TIER_INFO: Record<SubscriptionTier, {
  name: string;
  price: string;
  paymentDays: string;
  posts: string;
  features: string[];
  popular?: boolean;
}> = {
  bronze: {
    name: 'Bronze',
    price: '£29',
    paymentDays: '30 days',
    posts: '1-2 per month',
    features: ['Basic invoice tools', 'Standard reporting', 'Email support'],
  },
  silver: {
    name: 'Silver',
    price: '£59',
    paymentDays: '14 days',
    posts: 'Up to 5 per month',
    popular: true,
    features: ['Invoice tools', 'Analytics dashboard', 'Priority support'],
  },
  gold: {
    name: 'Gold',
    price: '£129',
    paymentDays: '7 days',
    posts: 'Unlimited',
    features: ['Advanced invoicing', 'Discounted insurance', 'Compliance tracking', 'Dedicated support'],
  },
};

export default function SubscriptionCard({ tier, isCurrentPlan, onSelect }: SubscriptionCardProps) {
  const info = TIER_INFO[tier];
  const isGold = tier === 'gold';
  return (
    <View style={[styles.card, isGold && styles.cardGold, isCurrentPlan && styles.cardCurrent]}>
      {info.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}
      <View style={styles.header}>
        <Text style={[styles.tierName, isGold && styles.tierNameGold]}>{info.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, isGold && styles.priceGold]}>{info.price}</Text>
          <Text style={styles.perMonth}>/month</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.detailRow}>
        <Ionicons name="time-outline" size={15} color={colors.textLight} />
        <Text style={styles.detailText}>Payout in <Text style={styles.bold}>{info.paymentDays}</Text></Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons name="briefcase-outline" size={15} color={colors.textLight} />
        <Text style={styles.detailText}>Live posts: <Text style={styles.bold}>{info.posts}</Text></Text>
      </View>
      <View style={styles.featuresList}>
        {info.features.map(f => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={15} color={isGold ? colors.accent : colors.success} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        onPress={onSelect}
        style={[styles.btn, isCurrentPlan && styles.btnCurrent, isGold && styles.btnGold]}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, isCurrentPlan && styles.btnTextCurrent]}>
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardGold: { borderColor: colors.accent, backgroundColor: '#FFFDF5' },
  cardCurrent: { borderColor: colors.primary },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  tierName: { fontSize: 22, fontWeight: '800', color: colors.text },
  tierNameGold: { color: colors.accent },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  price: { fontSize: 28, fontWeight: '800', color: colors.primary },
  priceGold: { color: colors.accent },
  perMonth: { fontSize: 13, color: colors.textLight, marginBottom: 4, marginLeft: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 13, color: colors.textLight },
  bold: { fontWeight: '700', color: colors.text },
  featuresList: { marginTop: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featureText: { fontSize: 13, color: colors.text },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnCurrent: { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.primary },
  btnGold: { backgroundColor: colors.accent },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  btnTextCurrent: { color: colors.primary },
});
