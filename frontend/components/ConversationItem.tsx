import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Conversation } from '@/constants/types';
import { colors } from '@/constants/colors';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

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

const SPRING = { damping: 20, stiffness: 320 };

export default function ConversationItem({ conversation, onPress }: ConversationItemProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={styles.item}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        activeOpacity={0.92}
      >
        <View style={styles.avatarWrap}>
          <Avatar name={conversation.participantName} />
          {conversation.unreadCount > 0 && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={[styles.name, conversation.unreadCount > 0 && styles.nameBold]}>
              {conversation.participantName}
            </Text>
            <Text style={styles.time}>{timeAgo(conversation.lastMessageTime)}</Text>
          </View>
          <Text
            style={[styles.preview, conversation.unreadCount > 0 && styles.previewBold]}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    backgroundColor: colors.white,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 15, color: colors.text, fontWeight: '500' },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 12, color: colors.textLight },
  preview: { fontSize: 13, color: colors.textLight },
  previewBold: { color: colors.text, fontWeight: '500' },
});
