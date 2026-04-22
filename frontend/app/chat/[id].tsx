import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import { signalRService } from '@/src/services/signalRService';
import { colors } from '@/constants/colors';
import { Message } from '@/constants/types';
import { useLayoutEffect } from 'react';

// Per-bubble entrance animation: slides in from the sender's side
function AnimatedBubble({
  index,
  isMine,
  children,
}: {
  index: number;
  isMine: boolean;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(isMine ? 30 : -30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = Math.min(index * 35, 200);
    translateX.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 200 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateGroup(timestamp: string): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getConversation, sendMessage, currentUser, fetchConversation, addIncomingMessage } = useApp();
  const conversation = getConversation(id);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useLayoutEffect(() => {
    if (conversation) {
      navigation.setOptions({
        title: conversation.participantName,
        headerRight: () => <Avatar name={conversation.participantName} />,
      });
    }
  }, [conversation]);

  useEffect(() => {
    fetchConversation(id);
  }, [id]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    signalRService.start()
      .then(() => signalRService.joinConversation(id))
      .catch(() => {});
    cleanup = signalRService.onReceiveMessage(msg => {
      if (msg.conversationId === id) {
        addIncomingMessage(msg);
      }
    });
    return () => {
      cleanup?.();
      signalRService.leaveConversation(id).catch(() => {});
    };
  }, [id]);

  useEffect(() => {
    if (conversation?.messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [conversation?.messages.length]);

  if (!conversation) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Conversation not found</Text>
      </View>
    );
  }

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(conversation.id, text.trim());
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const messages = conversation.messages;

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === currentUser?.id;
    const prevMsg = messages[index - 1];
    const showDateGroup =
      !prevMsg ||
      formatDateGroup(item.timestamp) !== formatDateGroup(prevMsg.timestamp);

    return (
      <AnimatedBubble index={index} isMine={isMine}>
        <View>
          {showDateGroup && (
            <View style={styles.dateGroup}>
              <Text style={styles.dateGroupText}>{formatDateGroup(item.timestamp)}</Text>
            </View>
          )}
          <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
            {!isMine && <Avatar name={conversation.participantName} />}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
              <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{formatTime(item.timestamp)}</Text>
            </View>
          </View>
        </View>
      </AnimatedBubble>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachBtn}>
          <Ionicons name="attach" size={22} color={colors.textLight} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textLight}
          value={text}
          onChangeText={setText}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: colors.textLight },
  messageList: { padding: 16 },
  dateGroup: { alignItems: 'center', marginVertical: 12 },
  dateGroupText: {
    fontSize: 12,
    color: colors.textLight,
    backgroundColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 8 },
  messageRowMine: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  bubble: {
    maxWidth: '72%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: { backgroundColor: '#EDEDED' },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.textLight, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.6)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  attachBtn: { padding: 4, marginBottom: 6 },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: colors.border },
});
