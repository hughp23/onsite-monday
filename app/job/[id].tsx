import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import Toast from '@/components/Toast';
import { colors } from '@/constants/colors';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, toggleJobInterest, acceptJob, currentUser, conversations } = useApp();
  const job = getJob(id);
  const insets = useSafeAreaInsets();
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  if (!job) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Job not found</Text>
      </View>
    );
  }

  const startDate = new Date(job.startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const endDate = new Date(job.endDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const handleInterest = () => {
    setShowInterestModal(true);
  };

  const confirmInterest = () => {
    acceptJob(job.id);
    setShowInterestModal(false);
    setToastMsg("You've expressed interest! We'll notify the job poster.");
    setToastVisible(true);
  };

  const handleMessage = () => {
    // Find or navigate to conversation with poster
    const existing = conversations.find(c => c.participantName.includes(job.postedByName.split(' ')[0]));
    if (existing) {
      router.push(`/chat/${existing.id}`);
    } else {
      router.push('/messages');
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="briefcase" size={52} color={colors.primary} />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <View style={styles.tradeRow}>
              <View style={styles.tradeBadge}>
                <MaterialCommunityIcons name="hammer-wrench" size={13} color={colors.primary} />
                <Text style={styles.tradeBadgeText}>{job.trade}</Text>
              </View>
              <TouchableOpacity
                onPress={() => toggleJobInterest(job.id)}
                style={styles.interestBtn}
              >
                <MaterialCommunityIcons
                  name={job.isInterested ? 'thumb-up' : 'thumb-up-outline'}
                  size={22}
                  color={job.isInterested ? colors.accent : colors.textLight}
                />
                <Text style={[styles.interestCount, job.isInterested && { color: colors.accent }]}>
                  {job.interestedCount}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Key info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-range" size={18} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Duration & Hours</Text>
              <Text style={styles.infoValue}>{job.duration} Day{job.duration > 1 ? 's' : ''} // {job.startTime} – {job.endTime}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar" size={18} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Dates</Text>
              <Text style={styles.infoValue}>{startDate} – {endDate}</Text>
              <View style={styles.daysRow}>
                {job.days.map(d => (
                  <View key={d} style={styles.dayPill}>
                    <Text style={styles.dayPillText}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{job.postcode}, {job.location}</Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Role</Text>
              <Text style={styles.detailValue}>{job.trade}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Day Rate</Text>
              <Text style={[styles.detailValue, styles.detailValuePrimary]}>£{job.dayRate}/d</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Posted By</Text>
              <Text style={styles.detailValue}>{job.postedByName} // {job.postedByBusiness}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Applicants</Text>
              <Text style={styles.detailValue}>{job.applicantCount} interested</Text>
            </View>
          </View>
        </View>

        {/* Brief */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brief</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {/* Payment terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Terms</Text>
          <View style={styles.paymentRow}>
            <MaterialCommunityIcons name="cash-check" size={20} color={colors.success} />
            <Text style={styles.paymentText}>{job.paymentTerms}</Text>
          </View>
        </View>

        {/* Message poster */}
        <TouchableOpacity style={styles.messageSection} onPress={handleMessage} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chat-question-outline" size={22} color={colors.primary} />
          <View style={styles.messageSectionContent}>
            <Text style={styles.messageSectionTitle}>Got a question?</Text>
            <Text style={styles.messageSectionSub}>Message the job poster now.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Sticky bottom button */}
      <View style={styles.stickyFooter}>
        {job.isInterested ? (
          <View style={styles.alreadyInterested}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
            <Text style={styles.alreadyInterestedText}>Interest expressed</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.interestedBtn} onPress={handleInterest} activeOpacity={0.85}>
            <Text style={styles.interestedBtnText}>I'm Interested</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Interest confirmation modal */}
      <Modal visible={showInterestModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowInterestModal(false)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="briefcase-check" size={48} color={colors.primary} />
            <Text style={styles.modalTitle}>Express Interest?</Text>
            <Text style={styles.modalDesc}>
              You'll be added to the interest list for "{job.title}" posted by {job.postedByName}.
            </Text>
            <Text style={styles.modalRate}>Day Rate: £{job.dayRate}/day</Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmInterest}>
              <Text style={styles.confirmBtnText}>Yes, I'm Interested</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowInterestModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: colors.textLight },
  scrollContent: { paddingBottom: 100 },
  hero: {
    backgroundColor: colors.white,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: { flex: 1 },
  jobTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tradeBadgeText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  interestBtn: { alignItems: 'center' },
  interestCount: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  infoCard: {
    backgroundColor: colors.white,
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  dayPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dayPillText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailGrid: { gap: 10 },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: colors.textLight },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 8 },
  detailValuePrimary: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  description: { fontSize: 14, color: colors.text, lineHeight: 22 },
  paymentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  paymentText: { fontSize: 14, color: colors.text, lineHeight: 20, flex: 1 },
  messageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  messageSectionContent: { flex: 1 },
  messageSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  messageSectionSub: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  bottomPadding: { height: 16 },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 24,
  },
  interestedBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  interestedBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  alreadyInterested: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  alreadyInterestedText: { fontSize: 16, color: colors.success, fontWeight: '600' },
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
  modalDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  modalRate: { fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: 24 },
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
