import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import StarRating from '@/components/StarRating';
import { colors } from '@/constants/colors';

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
const TIER_COLORS = { bronze: '#CD7F32', silver: '#A8A9AD', gold: colors.accent };

function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { currentUser } = useApp();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  if (!currentUser) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialCommunityIcons name="account-off-outline" size={48} color={colors.border} />
        <Text style={{ color: colors.textLight, marginTop: 12, fontSize: 15 }}>Profile not loaded</Text>
        <Text style={{ color: colors.textLight, marginTop: 4, fontSize: 13 }}>Check your connection and restart the app</Text>
      </View>
    );
  }

  const isProfileIncomplete = !currentUser.firstName && !currentUser.trade;
  const name = `${currentUser.firstName} ${currentUser.lastName}`.trim() || 'Your Name';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
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
            <Avatar name={name} />
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.metaText}>{currentUser.phone}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.metaText}>{currentUser.location}</Text>
          </View>
        </View>

        <View style={styles.body}>
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
            <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[currentUser.subscription] + '20' }]}>
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
        </View>
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
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  metaDot: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  avatar: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  body: { padding: 16 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
  },
  editBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chipAccred: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#27AE6015' },
  chipText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  chipTextAccred: { color: colors.success },
  emptyText: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },
  dayRate: { fontSize: 22, fontWeight: '800', color: colors.primary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  subscriptionSection: {},
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  upgradeLink: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  tierText: { fontSize: 15, fontWeight: '700' },
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
  signOutText: { color: colors.error, fontWeight: '600', fontSize: 15 },
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
  incompleteBannerText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.textLight, marginBottom: 24 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: colors.textLight, fontSize: 14 },
});
