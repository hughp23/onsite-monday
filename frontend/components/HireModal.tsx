import React, { useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { jobService } from '@/src/services/jobService';
import { colors } from '@/constants/colors';

interface Props {
  person: { id: string; firstName: string } | null;
  onClose: () => void;
  onInvited: (message: string) => void;
}

export default function HireModal({ person, onClose, onInvited }: Props) {
  const { myJobs } = useApp();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openJobs = myJobs.posted.filter(j => j.status === 'open');

  const close = () => { setSelectedJobId(null); setError(null); onClose(); };

  const confirm = async () => {
    if (!person || !selectedJobId) return;
    setSending(true);
    setError(null);
    try {
      await jobService.inviteToJob(selectedJobId, person.id);
      onInvited(`Invite sent to ${person.firstName}`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!person} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>Invite {person?.firstName} to a job</Text>
          {openJobs.length === 0 ? (
            <>
              <Text style={styles.empty}>You have no open jobs. Post one first, then invite {person?.firstName} to apply.</Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => { close(); router.push('/create-job'); }}>
                <Text style={styles.confirmText}>Post a job</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 280 }}>
                {openJobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.option, selectedJobId === job.id && styles.optionSelected]}
                    onPress={() => setSelectedJobId(job.id)}
                  >
                    <Text style={styles.optionTitle}>{job.title}</Text>
                    <Text style={styles.optionMeta}>{job.location} · £{job.dayRate}/day</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.confirmBtn, (!selectedJobId || sending) && { opacity: 0.5 }]}
                onPress={confirm}
                disabled={!selectedJobId || sending}
              >
                <Text style={styles.confirmText}>{sending ? 'Sending…' : 'Send invite'}</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  empty: { fontSize: 14, color: colors.textSecondary },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.chipBg },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  error: { color: colors.error, fontSize: 13 },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
