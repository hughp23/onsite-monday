import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <MaterialCommunityIcons name="hard-hat" size={56} color={colors.primary} />
      <Text style={styles.title}>Nothing on site here</Text>
      <Text style={styles.body}>This page doesn't exist or has moved.</Text>
      <Link href="/" style={styles.link}>Back to Onsite Monday</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  link: { marginTop: 12, fontSize: 15, fontWeight: '700', color: colors.primary },
});
