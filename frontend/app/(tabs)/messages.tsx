import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView, TouchableOpacity, Text, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import ConversationItem from '@/components/ConversationItem';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';
import {
  ConversationFilter,
  CONVERSATION_FILTER_LABELS,
  filterConversations,
} from '@/src/utils/conversationFilters';

const FILTERS: ConversationFilter[] = ['all', 'unread', 'jobs'];

const EMPTY_SUBTITLES: Record<ConversationFilter, string> = {
  all: 'Start a conversation with a tradesperson or job poster.',
  unread: 'You are all caught up.',
  jobs: 'Chats started from a job will appear here.',
};

const EMPTY_TITLES: Record<ConversationFilter, string> = {
  all: 'No messages yet',
  unread: 'No unread messages',
  jobs: 'No job chats',
};

export default function MessagesScreen() {
  const { conversations, markConversationRead, isLoading, refreshConversations } = useApp();

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

  const [filter, setFilter] = useState<ConversationFilter>('all');
  const unreadTotal = conversations.filter(c => c.unreadCount > 0).length;
  const visible = filterConversations(sorted, filter);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh';
      Alert.alert('Refresh failed', msg);
    } finally {
      setRefreshing(false);
    }
  }, [refreshConversations]);

  if (isLoading && conversations.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {CONVERSATION_FILTER_LABELS[f]}
              {f === 'unread' && unreadTotal > 0 ? ` (${unreadTotal})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index}>
            <ConversationItem
              conversation={item}
              onPress={() => {
                markConversationRead(item.id);
                router.push(`/chat/${item.id}`);
              }}
            />
          </AnimatedListItem>
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title={EMPTY_TITLES[filter]}
            subtitle={EMPTY_SUBTITLES[filter]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  filterScroll: { flexGrow: 0, maxHeight: 52, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  filterChipTextActive: { color: colors.white },
});
