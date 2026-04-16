import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification, NotificationType } from '@/constants/types';
import { colors } from '@/constants/colors';

interface NotificationItemProps {
  notification: AppNotification;
  onPress: () => void;
}

const ICONS: Record<NotificationType, string> = {
  application: 'person-add',
  accepted: 'checkmark-circle',
  payment: 'cash',
  review: 'star',
  profile_view: 'eye',
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function NotificationItem({ notification, onPress }: NotificationItemProps) {
  return (
    <TouchableOpacity
      style={[styles.item, !notification.isRead && styles.unread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={ICONS[notification.type] as any} size={22} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, !notification.isRead && styles.titleBold]}>{notification.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>{notification.description}</Text>
        <Text style={styles.time}>{timeAgo(notification.timestamp)}</Text>
      </View>
      {!notification.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    backgroundColor: colors.white,
  },
  unread: { backgroundColor: '#8B20200A', borderLeftWidth: 3, borderLeftColor: colors.primary },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  title: { fontSize: 14, color: colors.text, marginBottom: 3, fontWeight: '500' },
  titleBold: { fontWeight: '700' },
  desc: { fontSize: 13, color: colors.textLight, lineHeight: 18, marginBottom: 4 },
  time: { fontSize: 11, color: colors.textLight },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
