import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import PersonCard from '@/components/PersonCard';
import EmptyState from '@/components/EmptyState';
import Toast from '@/components/Toast';
import HireModal from '@/components/HireModal';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';

const FILTER_TRADES = ['All', 'Labourer', 'Joiner', 'Plumber', 'Electrician', 'Bricklayer', 'Roofer', 'Plasterer'];

export default function PeopleScreen() {
  const { tradespeople, loadTradespeople } = useApp();
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All');
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setIsLoadingPeople(true);
    loadTradespeople().finally(() => setIsLoadingPeople(false));
  }, [loadTradespeople]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTradespeople();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh';
      Alert.alert('Refresh failed', msg);
    } finally {
      setRefreshing(false);
    }
  }, [loadTradespeople]);
  const [hireModalPerson, setHireModalPerson] = useState<{ id: string; firstName: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const filtered = useMemo(() => {
    return tradespeople.filter(tp => {
      const name = `${tp.firstName} ${tp.lastName}`.toLowerCase();
      const matchSearch =
        !search ||
        name.includes(search.toLowerCase()) ||
        tp.trade.toLowerCase().includes(search.toLowerCase()) ||
        tp.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
      const matchTrade = tradeFilter === 'All' || tp.trade === tradeFilter;
      return matchSearch && matchTrade;
    });
  }, [tradespeople, search, tradeFilter]);

  if (isLoadingPeople) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, trade or skill..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Trade filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_TRADES.map(trade => (
          <TouchableOpacity
            key={trade}
            onPress={() => setTradeFilter(trade)}
            style={[styles.filterChip, tradeFilter === trade && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, tradeFilter === trade && styles.filterChipTextActive]}>
              {trade}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index}>
            <PersonCard
              person={item}
              onPress={() => router.push(`/person/${item.id}`)}
              onHire={() => setHireModalPerson({ id: item.id, firstName: item.firstName })}
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
            icon="people-outline"
            title="No tradespeople found"
            subtitle="Try adjusting your search or filter."
          />
        }
      />

      <HireModal
        person={hireModalPerson}
        onClose={() => setHireModalPerson(null)}
        onInvited={msg => { setToastMsg(msg); setToastVisible(true); }}
      />

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  filterScroll: { maxHeight: 52, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  filterChipTextActive: { color: colors.white },
  list: { padding: 16 },
});
