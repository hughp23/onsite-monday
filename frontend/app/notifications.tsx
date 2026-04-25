import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import NotificationItem from '@/components/NotificationItem';
import EmptyState from '@/components/EmptyState';
import AnimatedListItem from '@/components/AnimatedListItem';
import { colors } from '@/constants/colors';

export default function NotificationsScreen() {
  const { notifications, markNotificationRead, isLoading, refreshNotifications } = useApp();

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const unreadCount = sorted.filter(n => !n.isRead).length;

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshNotifications();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh';
      Alert.alert('Refresh failed', msg);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifications]);

  const handlePress = (id: string, linkedId?: string, type?: string) => {
    markNotificationRead(id);
    if (linkedId) {
      if (type === 'application' || type === 'accepted') {
        router.push(`/job/${linkedId}`);
      }
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
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
