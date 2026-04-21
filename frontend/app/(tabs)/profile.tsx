import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable, Image,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import StarRating from '@/components/StarRating';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
const TIER_COLORS = { bronze: '#CD7F32', silver: '#A8A9AD', gold: colors.accent };

function Avatar({ name, size = 72, imageUri }: { name: string; size?: number; imageUri?: string | null }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { currentUser } = useApp();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const headerTranslY = useSharedValue(-24);
  const headerOpacity = useSharedValue(0);
  const bodyTranslY   = useSharedValue(20);
  const bodyOpacity   = useSharedValue(0);

  useEffect(() => {
    const tc = { duration: 380, easing: Easing.out(Easing.cubic) };
    headerOpacity.value = withTiming(1, tc);
    headerTranslY.value = withTiming(0, tc);
    bodyOpacity.value   = withDelay(160, withTiming(1, tc));
    bodyTranslY.value   = withDelay(160, withTiming(0, tc));
  }, []);

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslY.value }],
  }));
  const bodyAnimStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslY.value }],
  }));

  if (!currentUser) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialCommunityIcons name="account-off-outline" size={48} color={colors.border} />
        <Text style={{ fontFamily: fonts.body, color: colors.textMuted, marginTop: 12, fontSize: 15 }}>Profile not loaded</Text>
        <Text style={{ fontFamily: fonts.body, color: colors.textMuted, marginTop: 4, fontSize: 13 }}>Check your connection and restart the app</Text>
      </View>
    );
  }

  const isProfileIncomplete = !currentUser.firstName && !currentUser.trade;
  const name = `${currentUser.firstName} ${currentUser.lastName}`.trim() || 'Your Name';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header with gradient */}
        <Animated.View style={headerAnimStyle}>
          <LinearGradient
            colors={[colors.primaryDark, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <View style={styles.headerTop}>
              <View style={styles.headerInfo}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.metaRow}>
                  <MaterialCommunityIcons name="hammer-wrench" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.metaText}>{currentUser.trade}</Text>
                  {currentUser.businessName ? (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <MaterialCommunityIcons name="domain" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.metaText}>{currentUser.businessName}</Text>
                    </>
                  ) : null}
                </View>
                <View style={styles.ratingRow}>
                  <StarRating rating={currentUser.rating} size={14} />
                  <Text style={styles.ratingText}>
                    {currentUser.rating.toFixed(1)} ({currentUser.reviewCount} reviews)
                  </Text>
                </View>
              </View>
              <Avatar name={name} imageUri={currentUser.profileImage} />
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaText}>{currentUser.phone}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaText}>{currentUser.location}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.body, bodyAnimStyle]}>
          {/* Incomplete profile banner */}
          {isProfileIncomplete && (
            <TouchableOpacity
              style={styles.incompleteBanner}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.85}
            >
              <Ionicons name="alert-circle-outline" size={20} color={colors.accent} />
              <Text style={styles.incompleteBannerText}>Your profile is incomplete — tap to finish setting it up</Text>
            </TouchableOpacity>
          )}

          {/* Edit Profile button */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          {/* Skills */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {currentUser.skills.length > 0 ? (
              <View style={styles.chipsWrap}>
                {currentUser.skills.map(skill => (
                  <View key={skill} style={styles.chip}>
                    <Text style={styles.chipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No skills added yet</Text>
            )}
          </View>

          {/* Accreditations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accreditations</Text>
            {currentUser.accreditations.length > 0 ? (
              <View style={styles.chipsWrap}>
                {currentUser.accreditations.map(acc => (
                  <View key={acc} style={[styles.chip, styles.chipAccred]}>
                    <Ionicons name="shield-checkmark-outline" size={12} color={colors.success} />
                    <Text style={[styles.chipText, styles.chipTextAccred]}>{acc}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No accreditations added yet</Text>
            )}
          </View>

          {/* Day rate */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Day Rate</Text>
            <Text style={styles.dayRate}>
              {currentUser.dayRateVisible ? `£${currentUser.dayRate}/day` : 'Available upon request'}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Travel</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={styles.locationText}>
                {currentUser.location} + {currentUser.travelRadius} miles
              </Text>
            </View>
          </View>

          {/* Subscription */}
          <View style={[styles.section, styles.subscriptionSection]}>
            <View style={styles.subHeader}>
              <Text style={styles.sectionTitle}>Subscription</Text>
              <TouchableOpacity onPress={() => router.push('/subscription')}>
                <Text style={styles.upgradeLink}>Upgrade →</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[currentUser.subscription] + '20', borderColor: TIER_COLORS[currentUser.subscription] + '40' }]}>
              <MaterialCommunityIcons
                name="crown"
                size={18}
                color={TIER_COLORS[currentUser.subscription]}
              />
              <Text style={[styles.tierText, { color: TIER_COLORS[currentUser.subscription] }]}>
                {TIER_LABELS[currentUser.subscription]} Plan
              </Text>
            </View>
          </View>

          {/* Gallery */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <Text style={styles.emptyText}>No gallery photos yet. Add some from Edit Profile.</Text>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => setShowSignOutModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Sign out confirmation */}
      <Modal visible={showSignOutModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowSignOutModal(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalDesc}>Are you sure you want to sign out?</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.error }]}
              onPress={() => { signOut(); router.replace('/'); }}
            >
              <Text style={styles.confirmBtnText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSignOutModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerInfo: { flex: 1 },
  name: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 0.5,
    lineHeight: 32,
    color: colors.white,
    marginBottom: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  metaDot: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.white },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  body: { padding: 16 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 3,
  },
  editBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
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
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipAccred: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#27AE6015' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary },
  chipTextAccred: { color: colors.success },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  dayRate: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.primary,
    letterSpacing: 0.5,
    lineHeight: 39,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  subscriptionSection: {},
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  upgradeLink: { fontFamily: fonts.bodySemiBold, color: colors.primary, fontSize: 13 },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
  },
  tierText: { fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.2 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  signOutText: { fontFamily: fonts.bodySemiBold, color: colors.error, fontSize: 15 },
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '60',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  incompleteBannerText: { fontFamily: fonts.body, flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.3, color: colors.text, marginBottom: 8 },
  modalDesc: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 14 },
});
