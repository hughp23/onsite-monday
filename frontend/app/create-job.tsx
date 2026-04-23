import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import Toast from '@/components/Toast';
import { colors } from '@/constants/colors';
import { TRADES } from '@/constants/trades';
import { DayLetter, Job } from '@/constants/types';

const ALL_DAYS: DayLetter[] = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'];

export default function CreateJobScreen() {
  const { addJob, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [trade, setTrade] = useState('');
  const [location, setLocation] = useState('');
  const [postcode, setPostcode] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayLetter[]>([]);
  const [startTime, setStartTime] = useState('8:00am');
  const [endTime, setEndTime] = useState('4:00pm');
  const [dayRate, setDayRate] = useState('');
  const [description, setDescription] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('7 days after completion');
  const [toastVisible, setToastVisible] = useState(false);
  const [showTradePicker, setShowTradePicker] = useState(false);

  const toggleDay = (day: DayLetter) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (!currentUser) return null;

  const handlePost = () => {
    if (!title || !trade || !location || !dayRate) {
      return;
    }
    const durationNum = parseInt(duration) || 1;
    const now = new Date();
    const startDateObj = startDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endDateObj = new Date(startDateObj.getTime() + (durationNum - 1) * 24 * 60 * 60 * 1000);

    const newJob: Job = {
      id: `job-${Date.now()}`,
      title,
      trade,
      location,
      postcode: postcode || 'YO1 1AA',
      duration: durationNum,
      days: selectedDays.length > 0 ? selectedDays : ['M', 'T', 'W', 'Th', 'F'],
      startDate: startDateObj.toISOString().split('T')[0],
      endDate: endDateObj.toISOString().split('T')[0],
      startTime,
      endTime,
      dayRate: parseInt(dayRate) || 150,
      description: description || `${title} job in ${location}.`,
      postedById: currentUser.id,
      postedByName: `${currentUser.firstName} ${currentUser.lastName.charAt(0)}`,
      postedByBusiness: currentUser.businessName,
      paymentTerms: `Paid within ${paymentTerms}, confirmed by both parties.`,
      status: 'open',
      interestedCount: 0,
      isInterested: false,
      applicantCount: 0,
      photos: [],
      createdAt: new Date().toISOString(),
    };

    addJob(newJob);
    setToastVisible(true);
    setTimeout(() => router.back(), 1800);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Job Title *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="briefcase-outline" size={18} color={colors.textLight} style={styles.icon} />
            <TextInput style={styles.input} placeholder="e.g. Kitchen Extension" placeholderTextColor={colors.textLight} value={title} onChangeText={setTitle} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Trade Required *</Text>
          <TouchableOpacity
            style={[styles.inputWrap, styles.pickerBtn]}
            onPress={() => setShowTradePicker(!showTradePicker)}
          >
            <MaterialCommunityIcons name="hammer-wrench" size={18} color={colors.textLight} style={styles.icon} />
            <Text style={[styles.input, !trade && { color: colors.textLight }]}>{trade || 'Select a trade'}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textLight} />
          </TouchableOpacity>
          {showTradePicker && (
            <View style={styles.tradePickerList}>
              {TRADES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tradeOption, trade === t && styles.tradeOptionSelected]}
                  onPress={() => { setTrade(t); setShowTradePicker(false); }}
                >
                  <Text style={[styles.tradeOptionText, trade === t && styles.tradeOptionTextSelected]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Location *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color={colors.textLight} style={styles.icon} />
              <TextInput style={styles.input} placeholder="City" placeholderTextColor={colors.textLight} value={location} onChangeText={setLocation} />
            </View>
          </View>
          <View style={[styles.inputGroup, { width: 110, marginLeft: 10 }]}>
            <Text style={styles.label}>Postcode</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} placeholder="YO1 1AA" placeholderTextColor={colors.textLight} value={postcode} onChangeText={setPostcode} autoCapitalize="characters" />
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity style={styles.inputWrap} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={18} color={colors.textLight} style={styles.icon} />
              <Text style={[styles.input, !startDate && { color: colors.textLight }]}>
                {startDate
                  ? startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Select start date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={startDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selected) setStartDate(selected);
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerDone}>
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.inputGroup, { width: 90, marginLeft: 10 }]}>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} placeholder="3" placeholderTextColor={colors.textLight} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
              <Text style={styles.inputSuffix}>days</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Working Days</Text>
          <View style={styles.daysRow}>
            {ALL_DAYS.map(day => (
              <TouchableOpacity
                key={day}
                style={[styles.dayBtn, selectedDays.includes(day) && styles.dayBtnActive]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.dayBtnText, selectedDays.includes(day) && styles.dayBtnTextActive]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Start Time</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} />
            </View>
          </View>
          <Text style={styles.timeSep}>–</Text>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>End Time</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Day Rate *</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.currency}>£</Text>
            <TextInput style={styles.input} placeholder="150" placeholderTextColor={colors.textLight} value={dayRate} onChangeText={setDayRate} keyboardType="number-pad" />
            <Text style={styles.inputSuffix}>/day</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Job Description</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the work required, access, PPE requirements..."
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Payment Terms</Text>
          <View style={styles.paymentOptions}>
            {['7 days after completion', '14 days after completion', '30 days after completion'].map(term => (
              <TouchableOpacity
                key={term}
                style={[styles.paymentOption, paymentTerms === term && styles.paymentOptionSelected]}
                onPress={() => setPaymentTerms(term)}
              >
                <Text style={[styles.paymentOptionText, paymentTerms === term && styles.paymentOptionTextSelected]}>
                  {term}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.postBtn, (!title || !trade || !location || !dayRate) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!title || !trade || !location || !dayRate}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="send" size={18} color={colors.white} />
          <Text style={styles.postBtnText}>Post Job</Text>
        </TouchableOpacity>
      </ScrollView>

      <Toast visible={toastVisible} message="Job posted successfully!" onHide={() => setToastVisible(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 50,
  },
  pickerBtn: { justifyContent: 'space-between' },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: colors.text },
  inputSuffix: { fontSize: 13, color: colors.textLight },
  currency: { fontSize: 16, fontWeight: '700', color: colors.text, marginRight: 4 },
  textAreaWrap: { height: 'auto', paddingVertical: 12, alignItems: 'flex-start' },
  textArea: { height: 90, textAlignVertical: 'top' },
  tradePickerList: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  tradeOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeOptionSelected: { backgroundColor: colors.chipBg },
  tradeOptionText: { fontSize: 14, color: colors.text },
  tradeOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  daysRow: { flexDirection: 'row', gap: 8 },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
  dayBtnTextActive: { color: colors.white },
  timeSep: { fontSize: 18, color: colors.textLight, paddingHorizontal: 8, marginBottom: 22 },
  paymentOptions: { gap: 8 },
  paymentOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  paymentOptionSelected: { borderColor: colors.primary, backgroundColor: colors.chipBg },
  paymentOptionText: { fontSize: 13, color: colors.text },
  paymentOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  postBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  postBtnDisabled: { backgroundColor: colors.border },
  postBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  datePickerDone: { alignItems: 'flex-end', paddingVertical: 6, paddingRight: 4 },
  datePickerDoneText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
});
