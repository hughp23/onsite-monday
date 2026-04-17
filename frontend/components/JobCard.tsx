import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Job } from '@/constants/types';
import { colors } from '@/constants/colors';

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
            <MaterialCommunityIcons name="briefcase" size={28} color={colors.primary} />
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
              <MaterialCommunityIcons name="hammer-wrench" size={13} color={colors.textLight} />
              <Text style={styles.metaText}>{job.trade}</Text>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={13} color={colors.textLight} />
              <Text style={styles.metaText} numberOfLines={1}>{job.location}</Text>
            </View>
            <View style={styles.bottomRow}>
              <View style={styles.daysRow}>
                <MaterialCommunityIcons name="calendar" size={13} color={colors.textLight} />
                <Text style={styles.metaText}>{job.duration} Day{job.duration > 1 ? 's' : ''} · </Text>
                {job.days.map(d => (
                  <Text key={d} style={styles.dayChip}>{d}</Text>
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
                color={job.isInterested ? colors.accent : colors.textLight}
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
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  metaText: { fontSize: 12, color: colors.textLight },
  dot: { color: colors.textLight, fontSize: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dayChip: { fontSize: 11, color: colors.primary, fontWeight: '600', marginRight: 2 },
  rate: { fontSize: 15, fontWeight: '700', color: colors.primary },
  thumbBtn: { alignItems: 'center', paddingLeft: 8 },
  thumbCount: { fontSize: 11, color: colors.textLight, marginTop: 2 },
});
