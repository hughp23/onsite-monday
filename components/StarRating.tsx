import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export default function StarRating({ rating, maxStars = 5, size = 16, interactive = false, onRate }: StarRatingProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        const iconName = filled ? 'star' : half ? 'star-half' : 'star-outline';
        if (interactive && onRate) {
          return (
            <TouchableOpacity key={i} onPress={() => onRate(i + 1)}>
              <Ionicons name={iconName as any} size={size} color={colors.accent} style={styles.star} />
            </TouchableOpacity>
          );
        }
        return <Ionicons key={i} name={iconName as any} size={size} color={colors.accent} style={styles.star} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { marginRight: 2 },
});
