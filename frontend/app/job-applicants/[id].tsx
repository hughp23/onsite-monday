import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { jobService } from '@/src/services/jobService';
import Toast from '@/components/Toast';
import { colors } from '@/constants/colors';
import { Applicant } from '@/constants/types';

export default function JobApplicantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, acceptJob } = useApp();
  const job = getJob(id);
  const insets = useSafeAreaInsets();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmApplicant, setConfirmApplicant] = useState<Applicant | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    jobService.getApplicants(id)
      .then(setApplicants)
      .catch(() => setApplicants([]))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAccept = async () => {
    if (!confirmApplicant) return;
    setAccepting(true);
    try {
      await acceptJob(id, confirmApplicant.id);
      setApplicants(prev => prev.map(a =>
        a.id === confirmApplicant.id ? { ...a, applicationStatus: 'accepted' } : a
      ));
      setToastMsg(`${confirmApplicant.firstName} has been accepted!`);
      setToastVisible(true);
    } finally {
      setConfirmApplicant(null);
      setAccepting(false);
    }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <Ionicons
            key={i}
            name={i <= full ? 'star' : 'star-outline'}
            size={12}
            color={i <= full ? colors.accent : colors.border}
          />
        ))}
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Applicant }) => {
    const initials = `${item.firstName[0]}${item.lastName[0]}`.toUpperCase();
    const isAccepted = item.applicationStatus === 'accepted';
    const canAccept = job?.status === 'open' || job?.status === 'applied';

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
            <Text style={styles.trade}>{item.trade}</Text>
            {renderStars(item.rating)}
            <Text style={styles.rate}>
              {item.dayRate > 0 ? `£${item.dayRate}/day` : 'Rate on request'}
            </Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => router.push(`/person/${item.id}`)}
            activeOpacity={0.75}
          >
            <Text style={styles.viewBtnText}>Profile</Text>
          </TouchableOpacity>
          {isAccepted ? (
            <View style={styles.hiredBadge}>
              <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
              <Text style={styles.hiredText}>Hired</Text>
            </View>
          ) : canAccept ? (
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => setConfirmApplicant(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={applicants}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          job ? (
            <View style={styles.header}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.subtitle}>{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-search-outline" size={52} color={colors.border} />
            <Text style={styles.emptyTitle}>No applicants yet</Text>
            <Text style={styles.emptySub}>Tradespeople who express interest will appear here.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Accept confirmation modal */}
      <Modal visible={!!confirmApplicant} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !accepting && setConfirmApplicant(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="account-check" size={48} color={colors.primary} />
            <Text style={styles.modalTitle}>Accept {confirmApplicant?.firstName}?</Text>
            <Text style={styles.modalDesc}>
              This will mark {confirmApplicant?.firstName} {confirmApplicant?.lastName} as the hired tradesperson for "{job?.title}".
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, accepting && { opacity: 0.6 }]}
              onPress={handleAccept}
              disabled={accepting}
            >
              <Text style={styles.confirmBtnText}>
                {accepting ? 'Accepting…' : 'Yes, Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmApplicant(null)} style={styles.cancelBtn} disabled={accepting}>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  header: { marginBottom: 16 },
  jobTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  trade: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  ratingText: { fontSize: 11, color: colors.textLight, marginLeft: 3 },
  rate: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 3 },
  cardActions: { gap: 8, alignItems: 'flex-end' },
  viewBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  acceptBtnText: { fontSize: 12, color: colors.white, fontWeight: '700' },
  hiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hiredText: { fontSize: 12, color: colors.success, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 16 },
  emptySub: { fontSize: 13, color: colors.textLight, textAlign: 'center', marginTop: 6, lineHeight: 20 },
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
