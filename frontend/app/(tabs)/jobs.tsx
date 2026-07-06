import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Pressable, ActivityIndicator, Alert,
  ScrollView, TextInput,
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
import { TRADES } from '@/constants/trades';

type SortOption = 'newest' | 'highest_pay' | 'shortest';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  highest_pay: 'Highest Pay',
  shortest: 'Shortest Duration',
};

const DAY_RATE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any rate', value: null },
  { label: '£100+/d', value: 100 },
  { label: '£200+/d', value: 200 },
  { label: '£300+/d', value: 300 },
  { label: '£400+/d', value: 400 },
];

function sortJobs(jobs: Job[], sort: SortOption): Job[] {
  return [...jobs].sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'highest_pay') return b.dayRate - a.dayRate;
    if (sort === 'shortest') return a.duration - b.duration;
    return 0;
  });
}

export default function JobsScreen() {
  const { jobs, toggleJobInterest, currentUser, isLoading, refreshJobs } = useApp();
  const insets = useSafeAreaInsets();

  const [sort, setSort] = useState<SortOption>('newest');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [minDayRate, setMinDayRate] = useState<number | null>(null);

  // Draft state inside filter modal (committed on Apply)
  const [draftLocation, setDraftLocation] = useState('');
  const [draftMinDayRate, setDraftMinDayRate] = useState<number | null>(null);

  const tradeInitialized = useRef(false);

  useEffect(() => {
    if (currentUser?.trade && !tradeInitialized.current) {
      setSelectedTrades([currentUser.trade]);
      tradeInitialized.current = true;
    }
  }, [currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh jobs';
      Alert.alert('Refresh failed', msg);
    } finally {
      setRefreshing(false);
    }
  }, [refreshJobs]);

  const openFilterModal = () => {
    setDraftLocation(locationFilter);
    setDraftMinDayRate(minDayRate);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setLocationFilter(draftLocation.trim());
    setMinDayRate(draftMinDayRate);
    setShowFilterModal(false);
  };

  const clearAllFilters = () => {
    setDraftLocation('');
    setDraftMinDayRate(null);
  };

  const toggleTrade = (trade: string) => {
    setSelectedTrades(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    );
  };

  const resetAllFilters = () => {
    setSelectedTrades([]);
    setLocationFilter('');
    setMinDayRate(null);
  };

  // Count of active non-trade filters (for badge)
  const extraFilterCount = (locationFilter ? 1 : 0) + (minDayRate !== null ? 1 : 0);

  if (isLoading && jobs.length === 0) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const filtered = jobs.filter(j => {
    if (j.status !== 'open') return false;
    if (selectedTrades.length > 0 && !selectedTrades.includes(j.trade)) return false;
    if (locationFilter && !j.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (minDayRate !== null && j.dayRate < minDayRate) return false;
    return true;
  });
  const sorted = sortJobs(filtered, sort);

  const anyFilterActive = selectedTrades.length > 0 || locationFilter !== '' || minDayRate !== null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Sort + filter bar */}
      <View style={styles.sortBar}>
        <Text style={styles.resultsText}>{sorted.length} job{sorted.length !== 1 ? 's' : ''}</Text>
        <View style={styles.sortBarRight}>
          {/* Filter button */}
          <TouchableOpacity
            style={[styles.iconBtn, extraFilterCount > 0 && styles.iconBtnActive]}
            onPress={openFilterModal}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={16}
              color={extraFilterCount > 0 ? colors.white : colors.primary}
            />
            <Text style={[styles.iconBtnText, extraFilterCount > 0 && styles.iconBtnTextActive]}>
              {extraFilterCount > 0 ? `Filters (${extraFilterCount})` : 'Filters'}
            </Text>
          </TouchableOpacity>

          {/* Sort button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSortModal(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="sort" size={16} color={colors.primary} />
            <Text style={styles.iconBtnText}>{SORT_LABELS[sort]}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trade chip row */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          <TouchableOpacity
            style={[styles.chip, selectedTrades.length === 0 && styles.chipActive]}
            onPress={() => setSelectedTrades([])}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selectedTrades.length === 0 && styles.chipTextActive]}>All trades</Text>
          </TouchableOpacity>
          {TRADES.map(trade => {
            const active = selectedTrades.includes(trade);
            return (
              <TouchableOpacity
                key={trade}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleTrade(trade)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{trade}</Text>
                {currentUser?.trade === trade && !active && (
                  <View style={styles.myTradeIndicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active filter summary row */}
      {anyFilterActive && (
        <View style={styles.activeFiltersBar}>
          <Text style={styles.activeFiltersText} numberOfLines={1}>
            {[
              selectedTrades.length > 0 ? selectedTrades.join(', ') : null,
              locationFilter ? `Near "${locationFilter}"` : null,
              minDayRate !== null ? `£${minDayRate}+/d` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
          <TouchableOpacity onPress={resetAllFilters} activeOpacity={0.7} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index}>
            <JobCard
              job={item}
              onPress={() => router.push(`/job/${item.id}`)}
              onInterest={item.postedById !== currentUser?.id ? () => toggleJobInterest(item.id) : undefined}
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
            title={anyFilterActive ? 'No matching jobs' : 'No jobs found'}
            subtitle={
              anyFilterActive
                ? 'Try adjusting your filters to see more results.'
                : 'Check back soon for new opportunities in your area.'
            }
          />
        }
      />

      {/* Sort modal */}
      <Modal visible={showSortModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Sort by</Text>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.sheetOption, sort === option && styles.sheetOptionActive]}
                onPress={() => { setSort(option); setShowSortModal(false); }}
              >
                <Text style={[styles.sheetOptionText, sort === option && styles.sheetOptionTextActive]}>
                  {SORT_LABELS[option]}
                </Text>
                {sort === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Filter modal */}
      <Modal visible={showFilterModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Pressable style={styles.bottomSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={clearAllFilters} activeOpacity={0.7}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            </View>

            {/* Location */}
            <Text style={styles.filterLabel}>Location</Text>
            <View style={styles.locationInput}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.locationTextInput}
                placeholder="e.g. York, Leeds, Manchester"
                placeholderTextColor={colors.textMuted}
                value={draftLocation}
                onChangeText={setDraftLocation}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {draftLocation.length > 0 && (
                <TouchableOpacity onPress={() => setDraftLocation('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Min day rate */}
            <Text style={styles.filterLabel}>Minimum day rate</Text>
            <View style={styles.chipRowInline}>
              {DAY_RATE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.chip, draftMinDayRate === opt.value && styles.chipActive]}
                  onPress={() => setDraftMinDayRate(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, draftMinDayRate === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>Apply filters</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { alignItems: 'center', justifyContent: 'center' },
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortBarRight: { flexDirection: 'row', gap: 8 },
  resultsText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  iconBtnTextActive: { color: colors.white },
  chipRow: {
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  myTradeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  chipRowInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  activeFiltersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryDark + '12',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '30',
    gap: 8,
  },
  activeFiltersText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
    flex: 1,
  },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMuted },
  list: { padding: 16, paddingTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 0.3,
    color: colors.text,
  },
  clearAllText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textMuted },
  sheetOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetOptionActive: {},
  sheetOptionText: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  sheetOptionTextActive: { fontFamily: fonts.bodyBold, color: colors.primary },
  filterLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    marginBottom: 20,
  },
  locationTextInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
});
