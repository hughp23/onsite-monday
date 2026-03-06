import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import { colors } from '@/constants/colors';
import { Job } from '@/constants/types';

type TabType = 'accepted' | 'posted';

export default function MyJobsScreen() {
  const { myJobs, markJobComplete } = useApp();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('accepted');
  const [completeModalJob, setCompleteModalJob] = useState<Job | null>(null);

  const handleMarkComplete = (job: Job) => {
    setCompleteModalJob(job);
  };

  const confirmComplete = () => {
    if (completeModalJob) {
      markJobComplete(completeModalJob.id);
      setCompleteModalJob(null);
      router.push(`/review/${completeModalJob.id}`);
    }
  };

  const renderAccepted = () => (
    <FlatList
      data={myJobs.accepted}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View>
          <JobCard
            job={item}
            onPress={() => router.push(`/job/${item.id}`)}
            showStatus
          />
          {item.status === 'in_progress' && (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => handleMarkComplete(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.white} />
              <Text style={styles.completeBtnText}>Mark Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <EmptyState
          icon="clipboard-text-outline"
          title="No accepted jobs"
          subtitle="Browse the jobs board to find and apply for work."
        />
      }
      ListFooterComponent={
        <TouchableOpacity onPress={() => router.push('/(tabs)/jobs')} style={styles.findMoreLink}>
          <Text style={styles.findMoreText}>Find more jobs →</Text>
        </TouchableOpacity>
      }
    />
  );

  const renderPosted = () => (
    <FlatList
      data={myJobs.posted}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View>
          <JobCard
            job={item}
            onPress={() => router.push(`/job/${item.id}`)}
            showStatus
          />
          <View style={styles.applicantBar}>
            <MaterialCommunityIcons name="account-group-outline" size={15} color={colors.textLight} />
            <Text style={styles.applicantText}>{item.applicantCount} interested</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <EmptyState
          icon="plus-circle-outline"
          title="No jobs posted yet"
          subtitle="Tap the + button to post your first job."
        />
      }
    />
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Segmented control */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(['accepted', 'posted'] as TabType[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentBtn, activeTab === tab && styles.segmentBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
                {tab === 'accepted' ? 'Accepted' : 'Posted'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'accepted' ? renderAccepted() : renderPosted()}

      {/* FAB */}
      {activeTab === 'posted' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => router.push('/create-job')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Mark Complete confirmation modal */}
      <Modal visible={!!completeModalJob} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setCompleteModalJob(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} />
            <Text style={styles.modalTitle}>Mark as Complete?</Text>
            <Text style={styles.modalDesc}>
              Marking "{completeModalJob?.title}" as complete will trigger a review and payment release.
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmComplete}>
              <Text style={styles.confirmBtnText}>Yes, Mark Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCompleteModalJob(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, color: colors.textLight, fontWeight: '500' },
  segmentTextActive: { color: colors.white, fontWeight: '700' },
  list: { padding: 16 },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success,
    marginHorizontal: 0,
    marginTop: -8,
    marginBottom: 12,
    borderRadius: 8,
    paddingVertical: 10,
  },
  completeBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  applicantBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 12,
    paddingLeft: 4,
  },
  applicantText: { fontSize: 12, color: colors.textLight },
  findMoreLink: { alignItems: 'center', marginTop: 8, paddingVertical: 12 },
  findMoreText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: colors.textLight, fontSize: 14 },
});
