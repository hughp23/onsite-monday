import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { usageBannerText, isAtLimit, UsageKind } from '@/src/utils/tierUsage';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

export default function UsageBanner({ kind }: { kind: UsageKind }) {
  const { usage } = useApp();
  const text = usageBannerText(usage, kind);
  if (!text) return null;
  const atLimit = isAtLimit(usage, kind);

  return (
    <TouchableOpacity
      style={[styles.banner, atLimit && styles.bannerLimit]}
      onPress={() => router.push('/subscription')}
      activeOpacity={0.85}
    >
      <MaterialCommunityIcons name={atLimit ? 'lock-outline' : 'information-outline'} size={16} color={atLimit ? colors.white : colors.primary} />
      <Text style={[styles.text, atLimit && styles.textLimit]}>{text}</Text>
      <Text style={[styles.cta, atLimit && styles.textLimit]}>Upgrade</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.chipBg,
  },
  bannerLimit: { backgroundColor: colors.primary },
  text: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  textLimit: { color: colors.white },
  cta: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
});
