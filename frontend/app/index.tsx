import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import { colors } from '@/constants/colors';

const { width } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 18, stiffness: 180, mass: 0.8 };
const TIMING_CONFIG = { duration: 400, easing: Easing.out(Easing.cubic) };

export default function WelcomeScreen() {
  const { isAuthenticated } = useApp();
  const insets = useSafeAreaInsets();

  // Shared animation values
  const logoScale     = useSharedValue(0.4);
  const logoOpacity   = useSharedValue(0);
  const titleTranslY  = useSharedValue(24);
  const titleOpacity  = useSharedValue(0);
  const iconLOpacity  = useSharedValue(0);
  const iconLScale    = useSharedValue(0.5);
  const iconCOpacity  = useSharedValue(0);
  const iconCScale    = useSharedValue(0.5);
  const iconROpacity  = useSharedValue(0);
  const iconRScale    = useSharedValue(0.5);
  const iconFloat     = useSharedValue(0);
  const textOpacity   = useSharedValue(0);
  const textTranslY   = useSharedValue(16);
  const btnsTranslY   = useSharedValue(48);
  const btnsOpacity   = useSharedValue(0);
  // Subtle rotating ring behind logo
  const ringRotate    = useSharedValue(0);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/jobs');
      return;
    }

    // Ring rotation
    ringRotate.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );

    // Logo springs in
    logoOpacity.value = withTiming(1, { duration: 300 });
    logoScale.value   = withSpring(1, SPRING_CONFIG);

    // Title fades up
    titleOpacity.value  = withDelay(200, withTiming(1, TIMING_CONFIG));
    titleTranslY.value  = withDelay(200, withTiming(0, TIMING_CONFIG));

    // Icons stagger in: center first, then left + right
    iconCOpacity.value = withDelay(380, withTiming(1, TIMING_CONFIG));
    iconCScale.value   = withDelay(380, withSpring(1, SPRING_CONFIG));

    iconLOpacity.value = withDelay(500, withTiming(1, TIMING_CONFIG));
    iconLScale.value   = withDelay(500, withSpring(1, SPRING_CONFIG));

    iconROpacity.value = withDelay(560, withTiming(1, TIMING_CONFIG));
    iconRScale.value   = withDelay(560, withSpring(1, SPRING_CONFIG));

    // Continuous gentle float on center icon
    iconFloat.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,  { duration: 1800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    // Subtitle + body fade in
    textOpacity.value = withDelay(640, withTiming(1, TIMING_CONFIG));
    textTranslY.value = withDelay(640, withTiming(0, TIMING_CONFIG));

    // Buttons slide up
    btnsOpacity.value = withDelay(780, withTiming(1, TIMING_CONFIG));
    btnsTranslY.value = withDelay(780, withTiming(0, TIMING_CONFIG));
  }, [isAuthenticated]);

  // Animated styles
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(ringRotate.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslY.value }],
  }));

  const iconLStyle = useAnimatedStyle(() => ({
    opacity: iconLOpacity.value,
    transform: [{ scale: iconLScale.value }],
  }));

  const iconCStyle = useAnimatedStyle(() => ({
    opacity: iconCOpacity.value,
    transform: [{ scale: iconCScale.value }, { translateY: iconFloat.value }],
  }));

  const iconRStyle = useAnimatedStyle(() => ({
    opacity: iconROpacity.value,
    transform: [{ scale: iconRScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslY.value }],
  }));

  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsOpacity.value,
    transform: [{ translateY: btnsTranslY.value }],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Decorative background rings */}
      <View style={styles.bgRingOuter} pointerEvents="none">
        <Animated.View style={[styles.bgRingInner, ringStyle]} />
      </View>
      <View style={styles.bgRingOuter2} pointerEvents="none" />

      {/* Logo area */}
      <View style={styles.logoArea}>
        <Animated.View style={[styles.monogram, logoStyle]}>
          <Text style={styles.monogramText}>ÔM</Text>
        </Animated.View>
        <Animated.View style={titleStyle}>
          <Text style={styles.appName}>Ônsite Monday</Text>
          <Text style={styles.tagline}>Your trusted trades network</Text>
        </Animated.View>
      </View>

      {/* Illustration area */}
      <View style={styles.illustrationArea}>
        <View style={styles.iconRow}>
          <Animated.View style={[styles.iconCircle, iconLStyle]}>
            <MaterialCommunityIcons name="hammer-wrench" size={34} color={colors.accent} />
          </Animated.View>

          <Animated.View style={[styles.iconCircleLarge, iconCStyle]}>
            <MaterialCommunityIcons name="domain" size={46} color={colors.white} />
          </Animated.View>

          <Animated.View style={[styles.iconCircle, iconRStyle]}>
            <MaterialCommunityIcons name="hard-hat" size={34} color={colors.accent} />
          </Animated.View>
        </View>

        <Animated.View style={textStyle}>
          <Text style={styles.subtitle}>Finding skilled tradespeople,{'\n'}on-demand.</Text>
          <Text style={styles.body}>
            Connect with the UK's best tradespeople,{'\n'}or find your next job today.
          </Text>
        </Animated.View>
      </View>

      {/* CTA area */}
      <Animated.View style={[styles.ctaArea, btnsStyle]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/sign-up')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Let's get started today!</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/sign-in')}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>
            Already have an account?{' '}
            <Text style={styles.linkText}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    overflow: 'hidden',
  },

  // Decorative background rings
  bgRingOuter: {
    position: 'absolute',
    top: -width * 0.55,
    right: -width * 0.35,
    width: width * 1.1,
    height: width * 1.1,
    borderRadius: width * 0.55,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgRingInner: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  bgRingOuter2: {
    position: 'absolute',
    bottom: -width * 0.4,
    left: -width * 0.3,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    paddingTop: 44,
  },
  monogram: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  monogramText: { fontSize: 30, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Icons
  illustrationArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 32,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconCircleLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  // Text
  subtitle: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 30,
  },
  body: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.68)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Buttons
  ctaArea: {
    paddingBottom: 20,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  linkText: { color: colors.accent, fontWeight: '600' },
});
