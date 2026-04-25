import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import ConversationItem from '@/components/ConversationItem';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';

export default function MessagesScreen() {
  const { conversations, markConversationRead, isLoading, refreshConversations } = useApp();

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

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
      <FlatList
        data={sorted}
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
            title="No messages yet"
            subtitle="Start a conversation with a tradesperson or job poster."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
});
