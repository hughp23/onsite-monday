import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import ChipSelector from '@/components/ChipSelector';
import { colors } from '@/constants/colors';
import { TRADES, SKILLS_BY_TRADE, ACCREDITATIONS } from '@/constants/trades';

const { width } = Dimensions.get('window');
const TOTAL_SLIDES = 8;

export default function SignUpScreen() {
  const { signIn, updateCurrentUser } = useApp();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedAccreditations, setSelectedAccreditations] = useState<string[]>([]);
  const [dayRate, setDayRate] = useState('');
  const [dayRateVisible, setDayRateVisible] = useState(true);
  const [location, setLocation] = useState('');
  const [travelRadius, setTravelRadius] = useState(25);

  const goNext = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      const next = currentSlide + 1;
      pagerRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentSlide(next);
    }
  };

  const goPrev = () => {
    if (currentSlide > 0) {
      const prev = currentSlide - 1;
      pagerRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentSlide(prev);
    }
  };

  const handleComplete = () => {
    const nameParts = fullName.trim().split(' ');
    updateCurrentUser({
      firstName: nameParts[0] || 'User',
      lastName: nameParts.slice(1).join(' ') || '',
      email,
      trade: selectedTrade,
      skills: selectedSkills,
      accreditations: selectedAccreditations,
      dayRate: parseInt(dayRate) || 150,
      dayRateVisible,
      location,
      travelRadius,
    });
    signIn();
    router.replace('/(tabs)/jobs');
  };

  const slides = [
    // Slide 1: Account creation
    <View style={styles.slide} key="s1">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>Create an account</Text>
        <TouchableOpacity onPress={() => router.push('/sign-in')}>
          <Text style={styles.slideSublink}>Already have an account? <Text style={styles.link}>Sign in</Text></Text>
        </TouchableOpacity>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Dave Mitchell" placeholderTextColor={colors.textLight} value={fullName} onChangeText={setFullName} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="dave@example.co.uk" placeholderTextColor={colors.textLight} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Create a password" placeholderTextColor={colors.textLight} value={password} onChangeText={setPassword} secureTextEntry />
          </View>
        </View>
        <View style={styles.illustrationWrap}>
          <MaterialCommunityIcons name="account-hard-hat-outline" size={80} color={colors.border} />
        </View>
      </View>
    </View>,

    // Slide 2: Trade selection
    <View style={styles.slide} key="s2">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>What's your trade?</Text>
        <Text style={styles.slideHint}>Select the trade that best describes your work</Text>
        <ScrollView style={styles.chipScroll} showsVerticalScrollIndicator={false}>
          <ChipSelector
            options={TRADES}
            selected={selectedTrade ? [selectedTrade] : []}
            onToggle={(t) => {
              setSelectedTrade(t === selectedTrade ? '' : t);
              setSelectedSkills([]);
            }}
            multiSelect={false}
          />
        </ScrollView>
      </View>
    </View>,

    // Slide 3: Skills
    <View style={styles.slide} key="s3">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>What are your skills?</Text>
        <Text style={styles.slideHint}>Select all that apply</Text>
        <ScrollView style={styles.chipScroll} showsVerticalScrollIndicator={false}>
          <ChipSelector
            options={selectedTrade ? (SKILLS_BY_TRADE[selectedTrade] || []) : Object.values(SKILLS_BY_TRADE).flat().slice(0, 15)}
            selected={selectedSkills}
            onToggle={(s) => setSelectedSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
          />
        </ScrollView>
      </View>
    </View>,

    // Slide 4: Accreditations
    <View style={styles.slide} key="s4">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>Your accreditations</Text>
        <Text style={styles.slideHint}>Add any certifications you hold</Text>
        <ScrollView style={styles.chipScroll} showsVerticalScrollIndicator={false}>
          <ChipSelector
            options={ACCREDITATIONS}
            selected={selectedAccreditations}
            onToggle={(a) => setSelectedAccreditations(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
          />
        </ScrollView>
        <TouchableOpacity onPress={goNext} style={styles.skipLink}>
          <Text style={styles.link}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>,

    // Slide 5: Day rate
    <View style={styles.slide} key="s5">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>Set your day rate</Text>
        <Text style={styles.slideHint}>How much do you charge per day?</Text>
        <View style={styles.rateInputWrap}>
          <Text style={styles.rateCurrency}>£</Text>
          <TextInput
            style={styles.rateInput}
            placeholder="200"
            placeholderTextColor={colors.textLight}
            value={dayRate}
            onChangeText={setDayRate}
            keyboardType="number-pad"
          />
          <Text style={styles.ratePerDay}>/day</Text>
        </View>
        <Text style={styles.rateHint}>
          {selectedTrade ? `Most ${selectedTrade}s in Yorkshire charge between £${
            selectedTrade === 'Electrician' ? '200 - £300' :
            selectedTrade === 'Plumber' ? '180 - £280' :
            selectedTrade === 'Roofer' ? '180 - £260' : '150 - £250'
          }` : 'Most tradespeople in Yorkshire charge between £150 - £250'}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show rate on profile</Text>
          <TouchableOpacity
            onPress={() => setDayRateVisible(!dayRateVisible)}
            style={[styles.toggle, dayRateVisible && styles.toggleActive]}
          >
            <View style={[styles.toggleThumb, dayRateVisible && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>
        {!dayRateVisible && <Text style={styles.rateHint}>Your rate will show as "Available upon request"</Text>}
      </View>
    </View>,

    // Slide 6: Location
    <View style={styles.slide} key="s6">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>Where are you based?</Text>
        <Text style={styles.slideHint}>We'll show you jobs in your area</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Location</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="York, UK"
              placeholderTextColor={colors.textLight}
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>
        <Text style={styles.label}>Travel Radius: {travelRadius} miles</Text>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>5</Text>
          <TouchableOpacity
            style={styles.sliderTrack}
            onPress={(e) => {
              const pct = e.nativeEvent.locationX / (width - 48 - 48);
              setTravelRadius(Math.round(5 + pct * 45));
            }}
          >
            <View style={[styles.sliderFill, { width: `${((travelRadius - 5) / 45) * 100}%` }]} />
            <View style={[styles.sliderThumb, { left: `${((travelRadius - 5) / 45) * 100}%` }]} />
          </TouchableOpacity>
          <Text style={styles.sliderLabel}>50</Text>
        </View>
        <Text style={styles.rateHint}>Jobs within {travelRadius} miles of {location || 'your location'} will appear in your feed.</Text>
      </View>
    </View>,

    // Slide 7: Profile photo
    <View style={styles.slide} key="s7">
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>Add a profile photo</Text>
        <Text style={styles.slideHint}>A photo helps job posters recognise you</Text>
        <View style={styles.photoPlaceholder}>
          <MaterialCommunityIcons name="camera-plus-outline" size={48} color={colors.border} />
          <Text style={styles.photoPlaceholderText}>No photo added</Text>
        </View>
        <TouchableOpacity style={styles.secondaryBtn}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]}>
          <Ionicons name="image-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>Choose from Library</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext} style={styles.skipLink}>
          <Text style={styles.link}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>,

    // Slide 8: All set
    <View style={styles.slide} key="s8">
      <View style={[styles.slideContent, styles.slideCenter]}>
        <View style={styles.successIcon}>
          <MaterialCommunityIcons name="check-circle" size={72} color={colors.success} />
        </View>
        <Text style={styles.slideTitle}>You're all set!</Text>
        <Text style={styles.slideHint}>Here's a summary of your profile:</Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryRow}>👤 {fullName || 'Your Name'}</Text>
          <Text style={styles.summaryRow}>🔨 {selectedTrade || 'Trade not set'}</Text>
          <Text style={styles.summaryRow}>📍 {location || 'Location not set'}</Text>
          <Text style={styles.summaryRow}>💰 {dayRateVisible ? `£${dayRate || '—'}/day` : 'Rate upon request'}</Text>
          <Text style={styles.summaryRow}>🎓 {selectedAccreditations.length} accreditation(s)</Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleComplete} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Go to Jobs Board</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>,
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          {currentSlide > 0 ? (
            <TouchableOpacity onPress={goPrev} style={styles.navBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Ônsite Monday</Text>
          <Text style={styles.slideCounter}>{currentSlide + 1}/{TOTAL_SLIDES}</Text>
        </View>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <View key={i} style={[styles.dot, i === currentSlide && styles.dotActive]} />
          ))}
        </View>
      </View>

      <FlatList
        ref={pagerRef}
        data={slides}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => item}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={styles.pager}
      />

      {/* Next button (not shown on last slide) */}
      {currentSlide < TOTAL_SLIDES - 1 && (
        <View style={[styles.nextBtnWrap, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>
              {currentSlide === 0 ? 'Create Account' :
               currentSlide === TOTAL_SLIDES - 2 ? 'Almost done!' : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  slideCounter: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 20, backgroundColor: colors.accent },
  pager: { flex: 1, backgroundColor: colors.background },
  slide: { width, flex: 1, backgroundColor: colors.background },
  slideContent: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  slideCenter: { alignItems: 'center', justifyContent: 'center' },
  slideTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 },
  slideHint: { fontSize: 14, color: colors.textLight, marginBottom: 20, lineHeight: 20 },
  slideSublink: { fontSize: 14, color: colors.textLight, marginBottom: 24 },
  link: { color: colors.primary, fontWeight: '600' },
  chipScroll: { flex: 1 },
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
  rateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    height: 68,
    marginBottom: 12,
  },
  rateCurrency: { fontSize: 32, fontWeight: '800', color: colors.primary, marginRight: 4 },
  rateInput: { fontSize: 40, fontWeight: '800', color: colors.text, flex: 1 },
  ratePerDay: { fontSize: 16, color: colors.textLight },
  rateHint: { fontSize: 12, color: colors.textLight, marginBottom: 16, lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  toggleLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  sliderLabel: { fontSize: 12, color: colors.textLight, width: 24, textAlign: 'center' },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  sliderThumb: {
    position: 'absolute',
    top: -9,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: -12,
  },
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    gap: 8,
  },
  photoPlaceholderText: { fontSize: 12, color: colors.textLight },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  secondaryBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  skipLink: { alignSelf: 'center', marginTop: 16 },
  successIcon: { marginBottom: 20 },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 28,
    width: '100%',
    gap: 8,
  },
  summaryRow: { fontSize: 14, color: colors.text, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  nextBtnWrap: { paddingHorizontal: 24, backgroundColor: colors.background },
  illustrationWrap: { alignItems: 'center', marginTop: 24 },
  success: { color: '#22C55E' },
});
