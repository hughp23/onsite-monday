import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import StarRating from './StarRating';
import { Tradesperson } from '@/constants/types';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

interface PersonCardProps {
  person: Tradesperson;
  onPress: () => void;
  onHire?: () => void;
}

function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

const SPRING = { damping: 20, stiffness: 320 };

export default function PersonCard({ person, onPress, onHire }: PersonCardProps) {
  const name = `${person.firstName} ${person.lastName}`;
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        activeOpacity={0.92}
      >
        <View style={styles.row}>
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.name}>{name}</Text>
              <Avatar name={name} />
            </View>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="hammer-wrench" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{person.trade}</Text>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{person.location}</Text>
              <Text style={styles.dot}>·</Text>
              <StarRating rating={person.rating} size={12} />
              <Text style={styles.ratingText}>{person.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.skillsRow}>
              {person.skills.slice(0, 3).map(skill => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                </View>
              ))}
              {person.skills.length > 3 && (
                <Text style={styles.moreChips}>+{person.skills.length - 3}</Text>
              )}
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.rate}>
                {person.dayRateVisible ? `£${person.dayRate}/d` : 'Rate upon request'}
              </Text>
              {onHire && (
                <TouchableOpacity onPress={onHire} style={styles.hireBtn} activeOpacity={0.7}>
                  <Text style={styles.hireBtnText}>Hire</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowWarm,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  row: { flexDirection: 'row' },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  name: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    flex: 1,
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 2.5,
    borderColor: colors.accent,
  },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  dot: { color: colors.textMuted, fontSize: 12 },
  ratingText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginLeft: 2 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textSecondary },
  moreChips: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, paddingVertical: 3 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rate: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.primary,
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  hireBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 7,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  hireBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 13 },
});
