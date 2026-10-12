import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { colors } from '@/constants/colors';

export default function NotificationSettingsScreen() {
  const { currentUser, updateCurrentUser } = useApp();
  const muted = currentUser?.mutedNotificationTypes ?? [];
  const [saving, setSaving] = useState(false);
  const messagesOn = !muted.includes('message');

  const toggleMessages = async (on: boolean) => {
    setSaving(true);
    try {
      await updateCurrentUser({
        mutedNotificationTypes: on ? muted.filter(t => t !== 'message') : [...muted, 'message'],
      });
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notification settings' }} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Message notifications</Text>
          <Text style={styles.sub}>Get a push notification when someone messages you.</Text>
        </View>
        <Switch
          value={messagesOn}
          onValueChange={toggleMessages}
          disabled={saving}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      <Text style={styles.note}>
        Job, payment and review updates always appear in your notifications list.
      </Text>
      <TouchableOpacity onPress={() => Linking.openSettings()}>
        <Text style={styles.link}>Open device notification settings →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceRaised, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  note: { fontSize: 13, color: colors.textSecondary },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
