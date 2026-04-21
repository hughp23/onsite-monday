import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SubscriptionTier } from '@/constants/types';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

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

  if (isGold) {
    return (
      <LinearGradient
        colors={['#2A0A0A', colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.cardGold, isCurrentPlan && styles.cardCurrentGold]}
      >
        <View style={styles.header}>
          <Text style={[styles.tierName, styles.tierNameGold]}>{info.name}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, styles.priceGold]}>{info.price}</Text>
            <Text style={[styles.perMonth, styles.perMonthGold]}>/month</Text>
          </View>
        </View>
        <View style={[styles.divider, styles.dividerGold]} />
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.6)" />
          <Text style={styles.detailTextGold}>Payout in <Text style={styles.boldGold}>{info.paymentDays}</Text></Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="briefcase-outline" size={15} color="rgba(255,255,255,0.6)" />
          <Text style={styles.detailTextGold}>Live posts: <Text style={styles.boldGold}>{info.posts}</Text></Text>
        </View>
        <View style={styles.featuresList}>
          {info.features.map(f => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
              <Text style={styles.featureTextGold}>{f}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          onPress={onSelect}
          style={[styles.btn, styles.btnGold, isCurrentPlan && styles.btnCurrentGold]}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, isCurrentPlan && styles.btnTextCurrentGold]}>
            {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.card, isCurrentPlan && styles.cardCurrent]}>
      {info.popular && (
        <View style={styles.popularBanner}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}
      <View style={[styles.header, info.popular && styles.headerWithBanner]}>
        <Text style={styles.tierName}>{info.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{info.price}</Text>
          <Text style={styles.perMonth}>/month</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.detailRow}>
        <Ionicons name="time-outline" size={15} color={colors.textMuted} />
        <Text style={styles.detailText}>Payout in <Text style={styles.bold}>{info.paymentDays}</Text></Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons name="briefcase-outline" size={15} color={colors.textMuted} />
        <Text style={styles.detailText}>Live posts: <Text style={styles.bold}>{info.posts}</Text></Text>
      </View>
      <View style={styles.featuresList}>
        {info.features.map(f => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        onPress={onSelect}
        style={[styles.btn, isCurrentPlan && styles.btnCurrent]}
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
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.shadowWarm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardGold: {
    borderColor: 'transparent',
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 5,
  },
  cardCurrent: { borderColor: colors.primary },
  cardCurrentGold: { borderWidth: 2, borderColor: colors.accent },

  // Silver "Most Popular" — full-width top banner
  popularBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingVertical: 7,
    alignItems: 'center',
  },
  popularText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.white,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  headerWithBanner: { marginTop: 24 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  tierName: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 1,
    color: colors.text,
    lineHeight: 32,
  },
  tierNameGold: { color: colors.accent },

  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  price: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.primary,
    lineHeight: 50,
    letterSpacing: 0,
  },
  priceGold: { color: colors.accent },
  perMonth: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  perMonthGold: { color: 'rgba(255,255,255,0.55)' },

  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
  dividerGold: { backgroundColor: 'rgba(255,255,255,0.15)' },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  detailTextGold: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  bold: { fontFamily: fonts.bodyBold, color: colors.text },
  boldGold: { fontFamily: fonts.bodyBold, color: colors.white },

  featuresList: { marginTop: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featureText: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  featureTextGold: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.9)' },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnCurrent: { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.primary },
  btnGold: { backgroundColor: colors.accent },
  btnCurrentGold: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: colors.accent },
  btnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
  btnTextCurrent: { color: colors.primary },
  btnTextCurrentGold: { color: colors.accent },
});
