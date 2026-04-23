import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import StarRating from '@/components/StarRating';
import ReviewCard from '@/components/ReviewCard';
import EmptyState from '@/components/EmptyState';
import { colors } from '@/constants/colors';

function Avatar({ name, size = 80, imageUri }: { name: string; size?: number; imageUri?: string | null }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
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

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tradespeople, startConversation, currentUser } = useApp();
  const person = tradespeople.find(t => t.id === id);
  const insets = useSafeAreaInsets();

  if (!person) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Person not found</Text>
      </View>
    );
  }

  const name = `${person.firstName} ${person.lastName}`;
  const [startingConv, setStartingConv] = useState(false);

  const handleMessage = async () => {
    if (startingConv) return;
    setStartingConv(true);
    try {
      const convId = await startConversation(person.id);
      router.push(`/chat/${convId}`);
    } finally {
      setStartingConv(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="hammer-wrench" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.metaText}>{person.trade}</Text>
                {person.businessName ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <MaterialCommunityIcons name="domain" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.metaText}>{person.businessName}</Text>
                  </>
                ) : null}
              </View>
              <View style={styles.ratingRow}>
                <StarRating rating={person.rating} size={14} />
                <Text style={styles.ratingText}>{person.rating.toFixed(1)} ({person.reviewCount})</Text>
              </View>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.metaText}>{person.phone}</Text>
              </View>
              <View style={styles.contactRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.metaText}>{person.location} + {person.travelRadius} miles</Text>
              </View>
            </View>
            <Avatar name={name} imageUri={person.profileImage} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Skills */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.chipsWrap}>
              {person.skills.map(skill => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Accreditations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accreditations</Text>
            <View style={styles.chipsWrap}>
              {person.accreditations.map(acc => (
                <View key={acc} style={[styles.chip, styles.chipAccred]}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={colors.success} />
                  <Text style={[styles.chipText, { color: colors.success }]}>{acc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Day rate */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Day Rate</Text>
            <Text style={styles.dayRate}>
              {person.dayRateVisible ? `£${person.dayRate}/day` : 'Available upon request'}
            </Text>
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews ({person.reviews.length})</Text>
            {person.reviews.length > 0 ? (
              person.reviews.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <Text style={styles.emptyText}>No reviews yet</Text>
            )}
          </View>

          {/* Gallery */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gallery</Text>
            {person.gallery.length > 0 ? (
              <View style={styles.gallery}>
                {person.gallery.map((img, i) => (
                  <View key={i} style={styles.galleryItem}>
                    <MaterialCommunityIcons name="image" size={32} color={colors.border} />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No gallery photos yet</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer — hidden when viewing own profile */}
      {currentUser?.id !== person.id && (
        <View style={styles.stickyFooter}>
          <TouchableOpacity style={styles.hireBtn} activeOpacity={0.85}>
            <MaterialCommunityIcons name="account-check" size={18} color={colors.white} />
            <Text style={styles.hireBtnText}>Hire {person.firstName}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.messageBtn, startingConv && { opacity: 0.6 }]} onPress={handleMessage} activeOpacity={0.85} disabled={startingConv}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: colors.textLight },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerInfo: { flex: 1, marginRight: 12 },
  name: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  metaDot: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  ratingText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  avatar: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800' },
  body: { padding: 16 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  chipAccred: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#27AE6015' },
  chipText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  dayRate: { fontSize: 22, fontWeight: '800', color: colors.primary },
  emptyText: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    gap: 12,
  },
  hireBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hireBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  messageBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messageBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
