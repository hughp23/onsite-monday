import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface Props {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string | string[];
  ctaLabel?: string;
  onPress?: () => void;
}

export default function InfoCard({ icon, title, body, ctaLabel, onPress }: Props) {
  const lines = Array.isArray(body) ? body : [body];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {lines.map((l, i) => <Text key={i} style={styles.body}>{l}</Text>)}
      {ctaLabel && onPress && (
        <TouchableOpacity onPress={onPress} style={styles.cta}>
          <Text style={styles.ctaText}>{ctaLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginHorizontal: 16, marginTop: 12, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  cta: { marginTop: 4 },
  ctaText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
