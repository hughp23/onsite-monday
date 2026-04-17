import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import ConversationItem from '@/components/ConversationItem';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';

export default function MessagesScreen() {
  const { conversations, markConversationRead } = useApp();

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

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
