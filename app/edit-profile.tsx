import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import ChipSelector from '@/components/ChipSelector';
import Toast from '@/components/Toast';
import { colors } from '@/constants/colors';
import { TRADES, SKILLS_BY_TRADE, ACCREDITATIONS } from '@/constants/trades';

export default function EditProfileScreen() {
  const { currentUser, updateCurrentUser } = useApp();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [businessName, setBusinessName] = useState(currentUser.businessName);
  const [phone, setPhone] = useState(currentUser.phone);
  const [trade, setTrade] = useState(currentUser.trade);
  const [skills, setSkills] = useState<string[]>(currentUser.skills);
  const [accreditations, setAccreditations] = useState<string[]>(currentUser.accreditations);
  const [dayRate, setDayRate] = useState(currentUser.dayRate.toString());
  const [dayRateVisible, setDayRateVisible] = useState(currentUser.dayRateVisible);
  const [location, setLocation] = useState(currentUser.location);
  const [travelRadius, setTravelRadius] = useState(currentUser.travelRadius);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const handleSave = () => {
    updateCurrentUser({
      firstName,
      lastName,
      businessName,
      phone,
      trade,
      skills,
      accreditations,
      dayRate: parseInt(dayRate) || currentUser.dayRate,
      dayRateVisible,
      location,
      travelRadius,
    });
    setToastVisible(true);
    setTimeout(() => router.back(), 1600);
  };

  const toggleSkill = (s: string) => setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleAcc = (a: string) => setAccreditations(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo placeholder */}
        <View style={styles.photoSection}>
          <View style={styles.photoCircle}>
            <Text style={styles.photoInitials}>
              {firstName.charAt(0)}{lastName.charAt(0)}
            </Text>
          </View>
          <TouchableOpacity style={styles.changePhotoBtn}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Personal Information</Text>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>First Name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Optional" placeholderTextColor={colors.textLight} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        <Text style={styles.sectionHeader}>Trade & Skills</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Trade</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerBtn]}
            onPress={() => setShowTradePicker(!showTradePicker)}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>{trade}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textLight} />
          </TouchableOpacity>
          {showTradePicker && (
            <View style={styles.pickerList}>
              {TRADES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pickerOption, trade === t && styles.pickerOptionActive]}
                  onPress={() => { setTrade(t); setSkills([]); setShowTradePicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, trade === t && styles.pickerOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Skills</Text>
          <ChipSelector
            options={SKILLS_BY_TRADE[trade] || []}
            selected={skills}
            onToggle={toggleSkill}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Accreditations</Text>
          <ChipSelector
            options={ACCREDITATIONS}
            selected={accreditations}
            onToggle={toggleAcc}
          />
        </View>

        <Text style={styles.sectionHeader}>Rate & Location</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Day Rate</Text>
          <View style={styles.rateRow}>
            <Text style={styles.rateCurrency}>£</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={dayRate}
              onChangeText={setDayRate}
              keyboardType="number-pad"
            />
            <Text style={styles.ratePerDay}>/day</Text>
          </View>
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show rate on profile</Text>
          <Switch
            value={dayRateVisible}
            onValueChange={setDayRateVisible}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Travel Radius: {travelRadius} miles</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>5</Text>
            <TouchableOpacity
              style={styles.sliderTrack}
              onPress={(e) => {
                const { width } = { width: 280 };
                const pct = Math.min(Math.max(e.nativeEvent.locationX / width, 0), 1);
                setTravelRadius(Math.round(5 + pct * 45));
              }}
            >
              <View style={[styles.sliderFill, { width: `${((travelRadius - 5) / 45) * 100}%` }]} />
            </TouchableOpacity>
            <Text style={styles.sliderLabel}>50</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>

      <Toast visible={toastVisible} message="Profile updated!" onHide={() => setToastVisible(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  photoSection: { alignItems: 'center', marginBottom: 24 },
  photoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoInitials: { color: colors.white, fontSize: 32, fontWeight: '800' },
  changePhotoBtn: { paddingVertical: 6 },
  changePhotoText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    color: colors.text,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  pickerList: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  pickerOption: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerOptionActive: { backgroundColor: colors.chipBg },
  pickerOptionText: { fontSize: 14, color: colors.text },
  pickerOptionTextActive: { color: colors.primary, fontWeight: '600' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateCurrency: { fontSize: 18, fontWeight: '700', color: colors.text },
  ratePerDay: { fontSize: 13, color: colors.textLight },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  toggleLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderLabel: { fontSize: 12, color: colors.textLight, width: 24 },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
