import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Job } from '@/constants/types';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

interface JobCardProps {
  job: Job;
  onPress: () => void;
  onInterest?: () => void;
  showStatus?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  open: colors.success,
  accepted: colors.accent,
  in_progress: '#2196F3',
  completed: colors.textLight,
  applied: '#9C27B0',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  accepted: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
  applied: 'Applied',
};

const SPRING = { damping: 20, stiffness: 320 };

export default function JobCard({ job, onPress, onInterest, showStatus = false }: JobCardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        activeOpacity={0.92}
      >
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="briefcase" size={24} color={colors.white} />
          </View>
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
              {showStatus && (
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[job.status] + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[job.status] }]}>
                    {STATUS_LABELS[job.status]}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="hammer-wrench" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{job.trade}</Text>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{job.location}</Text>
            </View>
            <View style={styles.bottomRow}>
              <View style={styles.daysRow}>
                <MaterialCommunityIcons name="calendar" size={13} color={colors.textMuted} />
                <Text style={styles.metaText}>{job.duration} Day{job.duration > 1 ? 's' : ''} · </Text>
                {job.days.map(d => (
                  <View key={d} style={styles.dayChip}>
                    <Text style={styles.dayChipText}>{d}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.rate}>£{job.dayRate}/d</Text>
            </View>
          </View>
          {onInterest && (
            <TouchableOpacity onPress={onInterest} style={styles.thumbBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons
                name={job.isInterested ? 'thumb-up' : 'thumb-up-outline'}
                size={20}
                color={job.isInterested ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.thumbCount, job.isInterested && { color: colors.accent }]}>
                {job.interestedCount}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowWarm,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  dot: { color: colors.textMuted, fontSize: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  dayChip: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 2,
  },
  dayChipText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.white },
  rate: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  thumbBtn: { alignItems: 'center', paddingLeft: 8 },
  thumbCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
