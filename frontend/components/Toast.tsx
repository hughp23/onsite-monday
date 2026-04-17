import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onHide?: () => void;
}

export default function Toast({ visible, message, type = 'success', onHide }: ToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const scale = useSharedValue(0.88);

  useEffect(() => {
    if (!visible) return;

    // Animate in
    opacity.value = withTiming(1, { duration: 280 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });

    // Animate out after hold
    const hideTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(16, { duration: 250 });
      scale.value = withTiming(0.9, { duration: 250 });
      setTimeout(() => onHide?.(), 260);
    }, 2200);

    return () => clearTimeout(hideTimer);
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!visible) return null;

  const bgColor =
    type === 'success' ? colors.success
    : type === 'error' ? colors.error
    : colors.primary;

  const iconName =
    type === 'success' ? 'checkmark-circle'
    : type === 'error' ? 'alert-circle'
    : 'information-circle';

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }, animStyle]}>
      <Ionicons name={iconName as any} size={20} color={colors.white} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
