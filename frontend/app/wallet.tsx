import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { walletService } from '@/src/services/walletService';
import { WalletDto, KycStatus } from '@/constants/types';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

// ─── KYC pill helper ────────────────────────────────────────────────────────

type PillConfig = { label: string; bg: string; text: string };

function kycPill(status: KycStatus): PillConfig {
  switch (status) {
    case 'verified': return { label: '✓ Verified',  bg: '#DCFCE7', text: '#166534' };
    case 'pending':  return { label: 'Pending',      bg: '#FEF9C3', text: '#854D0E' };
    case 'failed':   return { label: 'Failed',       bg: '#FEE2E2', text: colors.error };
    default:         return { label: 'Not started',  bg: '#F3F4F6', text: colors.textMuted };
  }
}

// ─── Setup banner ────────────────────────────────────────────────────────────

function SetupBanner({
  kycStatus,
  hasBankAccount,
}: {
  kycStatus: KycStatus;
  hasBankAccount: boolean;
}) {
  if (kycStatus === 'verified' && hasBankAccount) return null;

  let message: string;
  let ctaLabel: string | null = null;

  if (kycStatus === 'none') {
    message = 'Verify your identity to receive payouts.';
    ctaLabel = 'Verify identity →';
  } else if (kycStatus === 'pending') {
    message = "Identity verification in progress — we'll notify you when complete.";
  } else if (kycStatus === 'failed') {
    message = 'Verification failed — please try again.';
    ctaLabel = 'Retry verification →';
  } else {
    // kycStatus === 'verified' but !hasBankAccount
    message = 'Add a bank account to enable withdrawals.';
    ctaLabel = 'Add bank account →';
  }

  const handleCta = () =>
    Alert.alert('Setup Required', 'Complete identity verification through your account settings.');

  return (
    <View style={bannerStyles.banner}>
      <Text style={bannerStyles.title}>⚠ Complete your setup</Text>
      <Text style={bannerStyles.message}>{message}</Text>
      {ctaLabel !== null && (
        <TouchableOpacity onPress={handleCta} activeOpacity={0.8}>
          <Text style={bannerStyles.cta}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 2,
    borderBottomColor: '#FFE082',
    padding: 16,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#856404',
    marginBottom: 4,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#856404',
    marginBottom: 8,
  },
  cta: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
    backgroundColor: '#856404',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showSheet, setShowSheet] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);

  const isSetupComplete =
    wallet !== null && wallet.kycStatus === 'verified' && wallet.hasBankAccount;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await walletService.getWallet();
      setWallet(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load wallet');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAutoWithdraw = async (enabled: boolean) => {
    if (!wallet) return;
    const previous = wallet.autoWithdraw;
    setWallet({ ...wallet, autoWithdraw: enabled });
    try {
      await walletService.setAutoWithdraw(enabled);
    } catch {
      setWallet({ ...wallet, autoWithdraw: previous });
      Alert.alert('Error', 'Could not update auto-withdraw setting. Please try again.');
    }
  };

  const openSheet = () => {
    setWithdrawError(null);
    setWithdrawSuccess(false);
    setShowSheet(true);
  };

  const closeSheet = () => setShowSheet(false);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await walletService.withdraw();
      setWithdrawSuccess(true);
      setWallet(w => (w ? { ...w, balance: 0, balancePence: 0 } : w));
    } catch (e: any) {
      setWithdrawError(e?.message ?? 'Withdrawal failed. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error || !wallet) {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error ?? 'Failed to load wallet'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kyc = kycPill(wallet.kycStatus);

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Setup banner */}
        <SetupBanner kycStatus={wallet.kycStatus} hasBankAccount={wallet.hasBankAccount} />

        {/* Balance card */}
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>£{wallet.balance.toFixed(2)}</Text>
          <Text style={styles.balanceSub}>
            {isSetupComplete ? 'Ready to withdraw' : 'Complete setup to withdraw'}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          {/* Account status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Status</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Identity verification</Text>
              <View style={[styles.pill, { backgroundColor: kyc.bg }]}>
                <Text style={[styles.pillText, { color: kyc.text }]}>{kyc.label}</Text>
              </View>
            </View>
            <View style={[styles.statusRow, { marginBottom: 0 }]}>
              <Text style={styles.statusLabel}>Bank account</Text>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: wallet.hasBankAccount ? '#DCFCE7' : '#FEE2E2' },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: wallet.hasBankAccount ? '#166534' : colors.error },
                  ]}
                >
                  {wallet.hasBankAccount ? '✓ Added' : 'Not added'}
                </Text>
              </View>
            </View>
          </View>

          {/* Auto-withdraw toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Auto-withdraw</Text>
                <Text style={styles.toggleSub}>
                  Automatically send payouts to your bank account
                </Text>
              </View>
              <Switch
                value={wallet.autoWithdraw}
                onValueChange={handleAutoWithdraw}
                disabled={!isSetupComplete}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          {/* Withdraw button */}
          <TouchableOpacity
            style={[styles.withdrawBtn, !isSetupComplete && styles.withdrawBtnDisabled]}
            onPress={isSetupComplete ? openSheet : undefined}
            activeOpacity={isSetupComplete ? 0.8 : 1}
          >
            <MaterialCommunityIcons
              name="bank-transfer-out"
              size={20}
              color={isSetupComplete ? colors.white : colors.textMuted}
            />
            <Text
              style={[
                styles.withdrawBtnText,
                !isSetupComplete && styles.withdrawBtnTextDisabled,
              ]}
            >
              Withdraw funds
            </Text>
          </TouchableOpacity>
          {!isSetupComplete && (
            <Text style={styles.withdrawDisabledNote}>Complete setup to withdraw</Text>
          )}

          {/* Transaction history placeholder */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.historyHeader}
              onPress={() => setHistoryOpen(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                Transaction History
              </Text>
              <Ionicons
                name={historyOpen ? 'chevron-up' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
            {historyOpen && (
              <Text style={styles.historyPlaceholder}>Transaction history coming soon.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Withdraw bottom sheet */}
      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet}>
          <Pressable style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Withdraw funds</Text>

            {withdrawSuccess ? (
              <View style={styles.sheetSuccess}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text style={styles.sheetSuccessText}>Withdrawal requested</Text>
                <Text style={styles.sheetSuccessSub}>
                  Funds will arrive in 1–3 business days.
                </Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={closeSheet} activeOpacity={0.8}>
                  <Text style={styles.confirmBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.sheetBody}>
                  Transfer{' '}
                  <Text style={{ fontFamily: fonts.bodyBold }}>
                    £{wallet.balance.toFixed(2)}
                  </Text>{' '}
                  to your registered UK bank account.
                </Text>
                <Text style={styles.sheetNote}>
                  Processing typically takes 1–3 business days.
                </Text>

                {withdrawError !== null && (
                  <Text style={styles.sheetError}>{withdrawError}</Text>
                )}

                <TouchableOpacity
                  style={[styles.confirmBtn, withdrawing && { opacity: 0.7 }]}
                  onPress={handleWithdraw}
                  disabled={withdrawing}
                  activeOpacity={0.8}
                >
                  {withdrawing ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm withdrawal</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={closeSheet} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: fonts.body,
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 14 },

  balanceCard: { padding: 28, alignItems: 'center' },
  balanceLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  balanceAmount: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.white,
    letterSpacing: 0,
    lineHeight: 50,
  },
  balanceSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  body: { padding: 16 },

  section: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowWarm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 11 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  toggleSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  withdrawBtnDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  withdrawBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
  withdrawBtnTextDisabled: { color: colors.textMuted },
  withdrawDisabledNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyPlaceholder: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 10,
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    marginBottom: 8,
    letterSpacing: 0.4,
    lineHeight: 30,
  },
  sheetBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 21,
  },
  sheetNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 20,
  },
  sheetError: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.error,
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontFamily: fonts.bodySemiBold, color: colors.primary, fontSize: 14 },
  sheetSuccess: { alignItems: 'center', paddingVertical: 8 },
  sheetSuccessText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  sheetSuccessSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
});
