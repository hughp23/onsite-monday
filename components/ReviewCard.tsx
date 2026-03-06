import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StarRating from './StarRating';
import { Review } from '@/constants/types';
import { colors } from '@/constants/colors';

interface ReviewCardProps {
  review: Review;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const date = new Date(review.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <StarRating rating={review.rating} size={14} />
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.text}>"{review.text}"</Text>
      <Text style={styles.reviewer}>
        {review.reviewerName}
        {review.reviewerBusiness ? ` // ${review.reviewerBusiness}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  date: { fontSize: 12, color: colors.textLight },
  text: { fontSize: 14, color: colors.text, lineHeight: 20, fontStyle: 'italic', marginBottom: 8 },
  reviewer: { fontSize: 12, color: colors.textLight, fontWeight: '500' },
});
