import React from 'react';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import NotificationItem from '@/components/NotificationItem';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';

export default function NotificationsScreen() {
  const { notifications, markNotificationRead } = useApp();

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const unreadCount = sorted.filter(n => !n.isRead).length;

  const handlePress = (id: string, linkedId?: string, type?: string) => {
    markNotificationRead(id);
    if (linkedId) {
      if (type === 'application' || type === 'accepted') {
        router.push(`/job/${linkedId}`);
      }
    }
  };

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      )}
      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index}>
            <NotificationItem
              notification={item}
              onPress={() => handlePress(item.id, item.linkedId, item.type)}
            />
          </AnimatedListItem>
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="bell-outline"
            title="No notifications"
            subtitle="You'll see job applications, payment updates, and reviews here."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  unreadBanner: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadBannerText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
