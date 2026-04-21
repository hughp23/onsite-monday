import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { Job } from '@/constants/types';

type SortOption = 'newest' | 'highest_pay' | 'shortest';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  highest_pay: 'Highest Pay',
  shortest: 'Shortest Duration',
};

function sortJobs(jobs: Job[], sort: SortOption): Job[] {
  return [...jobs].sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'highest_pay') return b.dayRate - a.dayRate;
    if (sort === 'shortest') return a.duration - b.duration;
    return 0;
  });
}

export default function JobsScreen() {
  const { jobs, toggleJobInterest } = useApp();
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<SortOption>('newest');
  const [showSortModal, setShowSortModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const openJobs = jobs.filter(j => j.status === 'open');
  const sorted = sortJobs(openJobs, sort);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Sort bar */}
      <View style={styles.sortBar}>
        <Text style={styles.resultsText}>{sorted.length} jobs near York</Text>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setShowSortModal(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="sort" size={16} color={colors.primary} />
          <Text style={styles.sortBtnText}>{SORT_LABELS[sort]}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index}>
            <JobCard
              job={item}
              onPress={() => router.push(`/job/${item.id}`)}
              onInterest={() => toggleJobInterest(item.id)}
            />
          </AnimatedListItem>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="briefcase-outline"
            title="No jobs found"
            subtitle="Check back soon for new opportunities in your area."
          />
        }
      />

      {/* Sort modal */}
      <Modal visible={showSortModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.sortOption, sort === option && styles.sortOptionActive]}
                onPress={() => { setSort(option); setShowSortModal(false); }}
              >
                <Text style={[styles.sortOptionText, sort === option && styles.sortOptionTextActive]}>
                  {SORT_LABELS[option]}
                </Text>
                {sort === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultsText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  list: { padding: 16, paddingTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortModal: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sortModalTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 0.3,
    color: colors.text,
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortOptionActive: {},
  sortOptionText: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  sortOptionTextActive: { fontFamily: fonts.bodyBold, color: colors.primary },
});
