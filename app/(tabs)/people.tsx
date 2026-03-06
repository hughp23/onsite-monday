import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity,
  Modal, Pressable, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import PersonCard from '@/components/PersonCard';
import EmptyState from '@/components/EmptyState';
import Toast from '@/components/Toast';
import { colors } from '@/constants/colors';

const FILTER_TRADES = ['All', 'Labourer', 'Joiner', 'Plumber', 'Electrician', 'Bricklayer', 'Roofer', 'Plasterer'];

export default function PeopleScreen() {
  const { tradespeople, myJobs } = useApp();
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All');
  const [hireModalPerson, setHireModalPerson] = useState<string | null>(null);
  const [selectedJobForHire, setSelectedJobForHire] = useState<string | null>(null);
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

  const handleHireConfirm = () => {
    const person = tradespeople.find(tp => tp.id === hireModalPerson);
    setToastMsg(`Invite sent to ${person?.firstName}!`);
    setToastVisible(true);
    setHireModalPerson(null);
    setSelectedJobForHire(null);
  };

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
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            onPress={() => router.push(`/person/${item.id}`)}
            onHire={() => setHireModalPerson(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No tradespeople found"
            subtitle="Try adjusting your search or filter."
          />
        }
      />

      {/* Hire modal */}
      <Modal visible={!!hireModalPerson} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setHireModalPerson(null)}>
          <View style={styles.modal}>
            {(() => {
              const person = tradespeople.find(tp => tp.id === hireModalPerson);
              return (
                <>
                  <Text style={styles.modalTitle}>
                    Invite {person?.firstName} to a job
                  </Text>
                  <Text style={styles.modalSub}>Select one of your posted jobs:</Text>
                  {myJobs.posted.length === 0 ? (
                    <Text style={styles.noJobsText}>No jobs posted yet. Post a job first.</Text>
                  ) : (
                    myJobs.posted.map(job => (
                      <TouchableOpacity
                        key={job.id}
                        style={[
                          styles.jobOption,
                          selectedJobForHire === job.id && styles.jobOptionSelected,
                        ]}
                        onPress={() => setSelectedJobForHire(job.id)}
                      >
                        <Text style={styles.jobOptionText}>{job.title}</Text>
                        <Text style={styles.jobOptionMeta}>{job.location} · £{job.dayRate}/d</Text>
                      </TouchableOpacity>
                    ))
                  )}
                  <TouchableOpacity
                    style={[styles.confirmBtn, !selectedJobForHire && styles.confirmBtnDisabled]}
                    onPress={handleHireConfirm}
                    disabled={!selectedJobForHire}
                  >
                    <Text style={styles.confirmBtnText}>Send Invite</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </Pressable>
      </Modal>

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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: colors.textLight, marginBottom: 16 },
  noJobsText: { fontSize: 14, color: colors.textLight, textAlign: 'center', paddingVertical: 16 },
  jobOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  jobOptionSelected: { borderColor: colors.primary, backgroundColor: colors.chipBg },
  jobOptionText: { fontSize: 15, fontWeight: '600', color: colors.text },
  jobOptionMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmBtnDisabled: { backgroundColor: colors.border },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
