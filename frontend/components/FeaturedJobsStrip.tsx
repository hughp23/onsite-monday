import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { Job } from '@/constants/types';

interface FeaturedJobsStripProps {
  jobs: Job[];
}

export default function FeaturedJobsStrip({ jobs }: FeaturedJobsStripProps) {
  if (jobs.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Featured for you</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {jobs.map(job => (
          <TouchableOpacity
            key={job.id}
            style={styles.card}
            onPress={() => router.push(`/job/${job.id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.title} numberOfLines={2}>{job.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>{job.trade}</Text>
            <Text style={styles.meta} numberOfLines={1}>{job.location}</Text>
            <Text style={styles.rate}>£{job.dayRate}/day</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  heading: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 0.3,
    color: colors.text,
    marginBottom: 8,
  },
  scroll: { gap: 10 },
  card: {
    width: 220,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  rate: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary, marginTop: 4 },
});
