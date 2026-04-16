import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { colors } from '@/constants/colors';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { isAuthenticated } = useApp();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/jobs');
    }
  }, [isAuthenticated]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>OM</Text>
        </View>
        <Text style={styles.appName}>Onsite Monday</Text>
        <Text style={styles.tagline}>Your trusted trades network</Text>
      </View>

      {/* Illustration area */}
      <View style={styles.illustrationArea}>
        <View style={styles.iconRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="hammer-wrench" size={36} color={colors.accent} />
          </View>
          <View style={[styles.iconCircle, styles.iconCircleLarge]}>
            <MaterialCommunityIcons name="domain" size={48} color={colors.white} />
          </View>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="hard-hat" size={36} color={colors.accent} />
          </View>
        </View>
        <Text style={styles.subtitle}>Finding skilled tradespeople, on-demand.</Text>
        <Text style={styles.body}>
          Find great Tradespeople to work on your next job with.
        </Text>
      </View>

      {/* CTA area */}
      <View style={styles.ctaArea}>
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
          <Text style={styles.secondaryBtnText}>Already have an account? <Text style={styles.linkText}>Sign in</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  logoArea: {
    alignItems: 'center',
    paddingTop: 40,
  },
  monogram: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  monogramText: { fontSize: 32, fontWeight: '900', color: colors.primary },
  appName: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: colors.accent, marginTop: 6, fontStyle: 'italic' },
  illustrationArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  body: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  ctaArea: {
    paddingBottom: 20,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 8 },
  secondaryBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  linkText: { color: colors.accent, fontWeight: '600' },
});
