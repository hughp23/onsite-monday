import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/colors';

const EASE = { duration: 380, easing: Easing.out(Easing.cubic) };

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const logoScale    = useSharedValue(0.5);
  const logoOpacity  = useSharedValue(0);
  const titleTransY  = useSharedValue(16);
  const titleOpacity = useSharedValue(0);
  const illusOpacity = useSharedValue(0);
  const formTransY   = useSharedValue(28);
  const formOpacity  = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value  = withTiming(1, { duration: 280 });
    logoScale.value    = withSpring(1, { damping: 18, stiffness: 180 });
    titleOpacity.value = withDelay(150, withTiming(1, EASE));
    titleTransY.value  = withDelay(150, withTiming(0, EASE));
    illusOpacity.value = withDelay(250, withTiming(1, EASE));
    formOpacity.value  = withDelay(300, withTiming(1, EASE));
    formTransY.value   = withDelay(300, withTiming(0, EASE));
  }, []);

  const logoStyle  = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTransY.value }],
  }));
  const illusStyle = useAnimatedStyle(() => ({ opacity: illusOpacity.value }));
  const formStyle  = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTransY.value }],
  }));

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Please enter the email address linked to your account.');
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(trimmed);
      router.push({ pathname: '/reset-password', params: { email: trimmed } });
    } catch {
      // Show generic message to avoid leaking account existence (Cognito UserNotFoundException)
      Alert.alert('Something went wrong', 'If that email is registered, a reset code will be sent.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.monogram, logoStyle]}>
            <Text style={styles.monogramText}>OM</Text>
          </Animated.View>
          <Animated.View style={titleStyle}>
            <Text style={styles.headerTitle}>Reset Password</Text>
            <Text style={styles.headerSub}>We'll send a code to your email</Text>
          </Animated.View>
        </View>
        <Animated.View style={[styles.illustrationRow, illusStyle]}>
          <MaterialCommunityIcons name="lock-reset" size={60} color="rgba(255,255,255,0.3)" />
          <MaterialCommunityIcons name="email-outline" size={80} color="rgba(255,255,255,0.2)" />
          <MaterialCommunityIcons name="lock-reset" size={60} color="rgba(255,255,255,0.3)" />
        </Animated.View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={formStyle}>
          <Text style={styles.instruction}>
            Enter your account email address and we'll send you a 6-digit code to reset your password.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="dave@example.co.uk"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Code</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToSignIn} onPress={() => router.back()}>
            <Text style={styles.backToSignInText}>
              Back to <Text style={styles.link}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  backBtn: { marginBottom: 16 },
  headerContent: { alignItems: 'center', marginBottom: 16 },
  monogram: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  monogramText: { fontSize: 22, fontWeight: '900', color: colors.primary },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.white, marginBottom: 4, textAlign: 'center' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  illustrationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 8 },
  body: { flex: 1, backgroundColor: colors.background },
  bodyContent: { paddingHorizontal: 24, paddingTop: 24 },
  instruction: {
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: 28,
    textAlign: 'center',
  },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: colors.text },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  backToSignIn: { marginTop: 24, alignItems: 'center' },
  backToSignInText: { fontSize: 14, color: colors.textLight },
  link: { color: colors.primary, fontWeight: '600' },
});
