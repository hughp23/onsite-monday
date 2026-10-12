import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/context/AppContext';
import UsageBanner from '@/components/UsageBanner';
import { isAtLimit } from '@/src/utils/tierUsage';
import { colors } from '@/constants/colors';

const MAX = 1000;

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, applyToJob, usage } = useApp();
  const job = getJob(id);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = isAtLimit(usage, 'applications');

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await applyToJob(id, note);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Apply for job' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <UsageBanner kind="applications" />
        {job && (
          <View style={styles.jobCard}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobMeta}>{job.location} · £{job.dayRate}/day · {job.duration} days</Text>
          </View>
        )}

        <Text style={styles.label}>Message to the job poster (optional)</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={t => setNote(t.slice(0, MAX))}
          placeholder="Your availability, relevant experience, tickets and cards…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Text style={styles.counter}>{note.length}/{MAX}</Text>

        <Text style={styles.sectionTitle}>What happens next</Text>
        <Text style={styles.step}>1. The poster reviews your profile and message.</Text>
        <Text style={styles.step}>2. If they accept you, the job moves to My Work.</Text>
        <Text style={styles.step}>3. The poster pays into escrow before the job starts.</Text>
        <Text style={styles.step}>4. After completion and reviews, your payout is released on your plan's schedule.</Text>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submit, (submitting || blocked) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={submitting || blocked}
        >
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit application'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 8 },
  jobCard: { backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  jobTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  jobMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 12 },
  input: { minHeight: 140, backgroundColor: colors.surfaceRaised, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 16 },
  step: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  error: { color: colors.error, fontSize: 14, marginTop: 8 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceRaised },
  submit: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
