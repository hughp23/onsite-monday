import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/colors';

const EASE = { duration: 380, easing: Easing.out(Easing.cubic) };

export default function ResetPasswordScreen() {
  const { confirmPasswordReset } = useAuth();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleReset = async () => {
    if (!code.trim()) {
      Alert.alert('Code required', 'Please enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both password fields are identical.');
      return;
    }
    setIsLoading(true);
    try {
      await confirmPasswordReset(email ?? '', code.trim(), newPassword);
      Alert.alert(
        'Password reset',
        'Your password has been updated. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => router.replace('/sign-in') }],
      );
    } catch (err) {
      const isCodeMismatch = err instanceof Error && err.name === 'CodeMismatchException';
      Alert.alert(
        'Reset failed',
        isCodeMismatch
          ? 'The code is incorrect or has expired. Please request a new one.'
          : 'Something went wrong. Please try again.',
      );
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
            <Text style={styles.headerTitle}>Check Your Email</Text>
            <Text style={styles.headerSub}>
              Code sent to {email ?? 'your email'}
            </Text>
          </Animated.View>
        </View>
        <Animated.View style={[styles.illustrationRow, illusStyle]}>
          <MaterialCommunityIcons name="email-check-outline" size={60} color="rgba(255,255,255,0.3)" />
          <MaterialCommunityIcons name="shield-key-outline" size={80} color="rgba(255,255,255,0.2)" />
          <MaterialCommunityIcons name="email-check-outline" size={60} color="rgba(255,255,255,0.3)" />
        </Animated.View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={formStyle}>
          <View style={styles.infoBox}>
            <Ionicons name="mail-open-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              We've sent a 6-digit code to <Text style={styles.bold}>{email}</Text>. Enter it below along with your new password.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>6-Digit Code</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={colors.textLight}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textLight}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Repeat your new password"
                placeholderTextColor={colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleReset}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Set New Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendRow}
            onPress={() => router.replace('/forgot-password')}
          >
            <Text style={styles.resendText}>
              Didn't receive a code? <Text style={styles.link}>Request a new one</Text>
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
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: colors.textLight, lineHeight: 18 },
  bold: { fontWeight: '700', color: colors.text },
  inputGroup: { marginBottom: 16 },
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
  eyeBtn: { padding: 4 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  resendRow: { marginTop: 24, alignItems: 'center' },
  resendText: { fontSize: 13, color: colors.textLight },
  link: { color: colors.primary, fontWeight: '600' },
});
