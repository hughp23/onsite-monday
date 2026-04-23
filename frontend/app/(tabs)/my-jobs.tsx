import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Pressable,
  LayoutChangeEvent, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { Job } from '@/constants/types';

type TabType = 'accepted' | 'posted';

const SPRING = { damping: 22, stiffness: 200 };

export default function MyJobsScreen() {
  const { myJobs, markJobComplete, startJob, deleteJob, cancelJob } = useApp();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('accepted');
  const [completeModalJob, setCompleteModalJob] = useState<Job | null>(null);
  const [startModalJob, setStartModalJob] = useState<Job | null>(null);
  const [deleteModalJob, setDeleteModalJob] = useState<Job | null>(null);
  const [cancelModalJob, setCancelModalJob] = useState<Job | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [segWidth, setSegWidth] = useState(0);

  // Sliding segment indicator
  const indicatorX = useSharedValue(0);
  // Content fade when switching tabs
  const contentOpacity = useSharedValue(1);

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    contentOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      setActiveTab(tab);
      contentOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    }, 130);
  };

  useEffect(() => {
    if (segWidth === 0) return;
    const half = (segWidth - 8) / 2;
    indicatorX.value = withSpring(activeTab === 'accepted' ? 0 : half, SPRING);
  }, [activeTab, segWidth]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setSegWidth(e.nativeEvent.layout.width);
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: segWidth > 0 ? (segWidth - 8) / 2 : '50%' as any,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    flex: 1,
  }));

  const confirmComplete = () => {
    if (completeModalJob) {
      markJobComplete(completeModalJob.id);
      setCompleteModalJob(null);
      router.push(`/review/${completeModalJob.id}`);
    }
  };

  const confirmStart = () => {
    if (startModalJob) {
      startJob(startModalJob.id);
      setStartModalJob(null);
    }
  };

  const confirmDelete = async () => {
    if (deleteModalJob) {
      await deleteJob(deleteModalJob.id);
      setDeleteModalJob(null);
    }
  };

  const confirmCancel = async () => {
    if (cancelModalJob) {
      await cancelJob(cancelModalJob.id, cancelReason.trim() || undefined);
      setCancelModalJob(null);
      setCancelReason('');
    }
  };

  // Accepted tab: jobs the current user has been accepted for as a tradesperson
  const renderAccepted = () => (
    <FlatList
      data={myJobs.accepted}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => (
        <AnimatedListItem index={index}>
          <View>
            <JobCard
              job={item}
              onPress={() => router.push(`/job/${item.id}`)}
              showStatus
            />
            {item.status === 'accepted' && (
              <TouchableOpacity
                style={styles.cancelJobBtn}
                onPress={() => setCancelModalJob(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={styles.cancelJobBtnText}>Cancel Job</Text>
              </TouchableOpacity>
            )}
          </View>
        </AnimatedListItem>
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

  // Posted tab: jobs the current user posted as a job poster
  const renderPosted = () => (
    <FlatList
      data={myJobs.posted}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => (
        <AnimatedListItem index={index}>
          <View>
            <JobCard
              job={item}
              onPress={() => router.push(`/job/${item.id}`)}
              showStatus
            />

            {/* Applicant count — tappable to view applicants list */}
            <TouchableOpacity
              style={styles.applicantBar}
              onPress={() => router.push(`/job-applicants/${item.id}`)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="account-group-outline" size={15} color={colors.primary} />
              <Text style={styles.applicantText}>
                {item.applicantCount} interested
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>

            {/* Delete Job — shown when job is open (no hire yet) */}
            {item.status === 'open' && (
              <TouchableOpacity
                style={styles.deleteJobBtn}
                onPress={() => setDeleteModalJob(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
                <Text style={styles.deleteJobBtnText}>Delete Job</Text>
              </TouchableOpacity>
            )}

            {/* Start Job — shown when a tradesperson has been accepted */}
            {item.status === 'accepted' && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => setStartModalJob(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.white} />
                <Text style={styles.startBtnText}>Start Job &amp; Pay</Text>
              </TouchableOpacity>
            )}

            {/* Cancel Job — shown when a tradesperson has been accepted (before work starts) */}
            {item.status === 'accepted' && (
              <TouchableOpacity
                style={styles.cancelJobBtn}
                onPress={() => setCancelModalJob(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={styles.cancelJobBtnText}>Cancel Job</Text>
              </TouchableOpacity>
            )}

            {/* Mark Complete — shown when job is in progress */}
            {item.status === 'in_progress' && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => setCompleteModalJob(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.white} />
                <Text style={styles.completeBtnText}>Mark Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        </AnimatedListItem>
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
        <View style={styles.segment} onLayout={handleLayout}>
          <Animated.View style={[styles.segmentIndicator, indicatorStyle]} />
          {(['accepted', 'posted'] as TabType[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={styles.segmentBtn}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
                {tab === 'accepted' ? 'My Work' : 'Posted'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Animated.View style={contentStyle}>
        {activeTab === 'accepted' ? renderAccepted() : renderPosted()}
      </Animated.View>

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

      {/* Start Job confirmation modal */}
      <Modal visible={!!startModalJob} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setStartModalJob(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="play-circle" size={48} color={colors.primary} />
            <Text style={styles.modalTitle}>Start Job?</Text>
            <Text style={styles.modalDesc}>
              Starting "{startModalJob?.title}" requires a payment of{' '}
              <Text style={styles.modalAmount}>
                £{((startModalJob?.dayRate ?? 0) * (startModalJob?.duration ?? 1)).toLocaleString()}
              </Text>{' '}
              to be held securely until the job is complete. You will be redirected to complete payment.
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmStart}>
              <Text style={styles.confirmBtnText}>Yes, Proceed to Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStartModalJob(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Job confirmation modal */}
      <Modal visible={!!deleteModalJob} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setDeleteModalJob(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="delete" size={48} color={colors.error} />
            <Text style={styles.modalTitle}>Delete Job?</Text>
            <Text style={styles.modalDesc}>
              This will permanently remove "{deleteModalJob?.title}" and cannot be undone.
            </Text>
            <TouchableOpacity style={styles.destructiveBtn} onPress={confirmDelete}>
              <Text style={styles.confirmBtnText}>Yes, Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDeleteModalJob(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Cancel Job confirmation modal */}
      <Modal visible={!!cancelModalJob} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setCancelModalJob(null); setCancelReason(''); }}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="close-circle" size={48} color={colors.error} />
            <Text style={styles.modalTitle}>Cancel Job?</Text>
            <Text style={styles.modalDesc}>
              This cannot be undone. If payment was made, it will be refunded to the job poster.
            </Text>
            <TextInput
              style={styles.cancelReasonInput}
              placeholder="Reason for cancelling (optional)"
              placeholderTextColor={colors.textMuted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.destructiveBtn} onPress={confirmCancel}>
              <Text style={styles.confirmBtnText}>Yes, Cancel Job</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCancelModalJob(null); setCancelReason(''); }} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Mark Complete confirmation modal */}
      <Modal visible={!!completeModalJob} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setCompleteModalJob(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} />
            <Text style={styles.modalTitle}>Mark as Complete?</Text>
            <Text style={styles.modalDesc}>
              Marking "{completeModalJob?.title}" as complete will release the escrowed payment and trigger a review.
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
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted },
  segmentTextActive: { fontFamily: fonts.bodyBold, color: colors.white },
  list: { padding: 16 },
  applicantBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  applicantText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.primary, flex: 1 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    marginBottom: 4,
    borderRadius: 8,
    paddingVertical: 10,
  },
  startBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 14 },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success,
    marginBottom: 12,
    borderRadius: 8,
    paddingVertical: 10,
  },
  completeBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 14 },
  findMoreLink: { alignItems: 'center', marginTop: 8, paddingVertical: 12 },
  findMoreText: { fontFamily: fonts.bodySemiBold, color: colors.primary, fontSize: 14 },
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
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 0.3,
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  modalDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalAmount: { fontFamily: fonts.bodyBold, color: colors.primary },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14 },
  deleteJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: 12,
    borderRadius: 8,
    paddingVertical: 10,
  },
  deleteJobBtnText: { fontFamily: fonts.bodyBold, color: colors.error, fontSize: 14 },
  cancelJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: 12,
    borderRadius: 8,
    paddingVertical: 10,
  },
  cancelJobBtnText: { fontFamily: fonts.bodyBold, color: colors.error, fontSize: 14 },
  destructiveBtn: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  cancelReasonInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surfaceSunken,
    marginBottom: 20,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
