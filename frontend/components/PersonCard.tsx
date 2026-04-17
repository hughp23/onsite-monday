import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import StarRating from './StarRating';
import { Tradesperson } from '@/constants/types';
import { colors } from '@/constants/colors';

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
              <MaterialCommunityIcons name="hammer-wrench" size={13} color={colors.textLight} />
              <Text style={styles.metaText}>{person.trade}</Text>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={13} color={colors.textLight} />
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
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row' },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  avatarText: { color: colors.white, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.textLight },
  dot: { color: colors.textLight, fontSize: 12 },
  ratingText: { fontSize: 12, color: colors.textLight, marginLeft: 2 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: { fontSize: 11, color: colors.primary, fontWeight: '500' },
  moreChips: { fontSize: 11, color: colors.textLight, paddingVertical: 3 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rate: { fontSize: 15, fontWeight: '700', color: colors.primary },
  hireBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  hireBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
