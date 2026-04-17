import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface Props {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
  /** ms per item; default 55 */
  step?: number;
  /** max stagger delay cap in ms; default 300 */
  maxDelay?: number;
}

export default function AnimatedListItem({
  index,
  children,
  style,
  step = 55,
  maxDelay = 300,
}: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const delay = Math.min(index * step, maxDelay);
    const config = { duration: 380, easing: Easing.out(Easing.cubic) };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateY.value = withDelay(delay, withTiming(0, config));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
}
