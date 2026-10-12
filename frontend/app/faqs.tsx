import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { TIER_INFO } from '@/constants/tiers';

// Payout timing is built from TIER_INFO so tier logic stays centralised.
const PAYOUT_ANSWER = `It depends on your plan: ${(['bronze', 'silver', 'gold'] as const)
  .map((t) => `${TIER_INFO[t].name} ${TIER_INFO[t].paymentDays}`)
  .join(', ')} after the job poster's review.`;

// TODO(product owner): the support email is a placeholder - confirm before release.
// The cancellation/refund wording reflects today's manual refund process; update it
// if refunds become automatic.
const FAQS: { q: string; a: string }[] = [
  { q: 'How do I get paid?', a: 'When the job poster starts the job, they pay into escrow through Stripe. After the job is marked complete and the job poster has left their review, your payout is released to your bank account through Stripe.' },
  { q: 'How long do payouts take?', a: PAYOUT_ANSWER },
  { q: 'Why do I have to leave a review?', a: 'Reviews keep the marketplace trustworthy. Payment is released only after the job poster reviews the tradesperson, and you cannot post or apply for new jobs while a review is outstanding.' },
  { q: 'How many jobs can I post or apply for?', a: 'Each plan includes a monthly allowance, shown on your Home screen and Subscription page. Limits reset on the 1st of each month.' },
  { q: 'Can I cancel a job?', a: 'An accepted job can be cancelled by either side before it starts. If funds are held, we will arrange a refund to the job poster.' },
  { q: 'Why do I need to verify my identity?', a: 'Stripe needs to verify tradespeople before paying out, to meet UK financial regulations. You can do this from Wallet.' },
  { q: 'How do I contact support?', a: 'Email support@onsitemonday.co.uk and we will get back to you within one working day.' },
];

export default function FaqsScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {FAQS.map((item, i) => {
        const open = openIndex === i;
        return (
          <View key={item.q} style={styles.card}>
            <TouchableOpacity
              style={styles.questionRow}
              onPress={() => setOpenIndex(open ? null : i)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.question}>{item.q}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {open && <Text style={styles.answer}>{item.a}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: 12, paddingHorizontal: 16 },
  questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 },
  question: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  answer: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, paddingBottom: 14 },
});
