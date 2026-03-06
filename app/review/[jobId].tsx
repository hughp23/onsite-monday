import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import StarRating from '@/components/StarRating';
import { colors } from '@/constants/colors';

const PAYOUT_DAYS: Record<string, number> = {
  bronze: 30,
  silver: 14,
  gold: 7,
};

export default function ReviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { getJob, submitReview, currentUser, tradespeople } = useApp();
  const job = getJob(jobId);
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Find the tradesperson for this job (first in list for demo, or by matching)
  const tradesperson = tradespeople.find(tp =>
    tp.trade === job?.trade
  ) || tradespeople[0];

  const payoutDays = PAYOUT_DAYS[currentUser.subscription];
  const totalPay = (job?.dayRate || 0) * (job?.duration || 1);

  const handleSubmit = () => {
    if (rating === 0) return;
    if (tradesperson) {
      submitReview(tradesperson.id, {
        rating,
        text: reviewText || 'Great work, would recommend.',
        reviewerName: `${currentUser.firstName} ${currentUser.lastName}`,
        reviewerBusiness: currentUser.businessName,
        date: new Date().toISOString().split('T')[0],
        jobId: jobId,
      });
    }
    setShowSuccess(true);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Job summary */}
        {job && (
          <View style={styles.jobCard}>
            <Text style={styles.jobCardTitle}>{job.title}</Text>
            <Text style={styles.jobCardMeta}>
              {job.postedByName} // {job.postedByBusiness}
            </Text>
            <Text style={styles.jobCardMeta}>
              {new Date(job.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
              {new Date(job.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Text style={styles.jobCardPay}>Total: £{totalPay}</Text>
          </View>
        )}

        {/* Star rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingTitle}>How would you rate this job?</Text>
          <View style={styles.starsWrap}>
            <StarRating
              rating={rating}
              size={44}
              interactive
              onRate={setRating}
            />
          </View>
          <Text style={styles.ratingHint}>
            {rating === 0 ? 'Tap a star to rate' :
             rating === 1 ? 'Poor' :
             rating === 2 ? 'Below average' :
             rating === 3 ? 'Average' :
             rating === 4 ? 'Good' : 'Excellent!'}
          </Text>
        </View>

        {/* Review text */}
        <View style={styles.section}>
          <Text style={styles.label}>Write your review</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Share your experience working on this job..."
            placeholderTextColor={colors.textLight}
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{reviewText.length} characters</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="send-check" size={20} color={colors.white} />
          <Text style={styles.submitBtnText}>Submit Review</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setShowSuccess(false); router.replace('/(tabs)/my-jobs'); }}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="cash-check" size={56} color={colors.success} />
            <Text style={styles.modalTitle}>Review Submitted!</Text>
            <Text style={styles.modalDesc}>
              Thank you for your review. Your payment of{' '}
              <Text style={styles.payAmount}>£{totalPay}</Text> will be released within{' '}
              <Text style={styles.payAmount}>{payoutDays} days</Text>.
            </Text>
            <Text style={styles.tierNote}>
              As a {currentUser.subscription.charAt(0).toUpperCase() + currentUser.subscription.slice(1)} member,
              you benefit from {payoutDays}-day payment terms.
            </Text>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => { setShowSuccess(false); router.replace('/(tabs)/my-jobs'); }}
            >
              <Text style={styles.confirmBtnText}>Back to My Jobs</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  jobCardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  jobCardMeta: { fontSize: 13, color: colors.textLight, marginBottom: 2 },
  jobCardPay: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 8 },
  ratingSection: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  starsWrap: { marginBottom: 12 },
  ratingHint: { fontSize: 14, color: colors.textLight, fontStyle: 'italic' },
  section: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 10 },
  textArea: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: colors.textLight, textAlign: 'right', marginTop: 6 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitBtnDisabled: { backgroundColor: colors.border },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
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
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 12, marginBottom: 10 },
  modalDesc: { fontSize: 15, color: colors.text, textAlign: 'center', lineHeight: 22, marginBottom: 10 },
  payAmount: { color: colors.primary, fontWeight: '800' },
  tierNote: { fontSize: 12, color: colors.textLight, textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
