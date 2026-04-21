import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

function NotificationBell() {
  const { getUnreadNotificationCount } = useApp();
  const count = getUnreadNotificationCount();
  return (
    <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.bellBtn}>
      <Ionicons name="notifications-outline" size={24} color={colors.white} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MessagesTabIcon({ color, size }: { color: string; size: number }) {
  const { getUnreadMessageCount } = useApp();
  const unread = getUnreadMessageCount();
  return (
    <View>
      <Ionicons name="chatbubble-outline" size={size} color={color} />
      {unread > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{unread}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated } = useApp();
  const { isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Only redirect once Firebase has determined auth state.
    // Redirecting while isAuthLoading=true would destroy nav history
    // before the session is resolved, causing GO_BACK errors.
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isAuthLoading]);

  // Keep the navigator unmounted until auth is resolved to avoid
  // rendering protected tabs for an unauthenticated user.
  if (isAuthLoading || !isAuthenticated) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          shadowColor: colors.shadowWarm,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontFamily: fonts.display,
          fontSize: 22,
          letterSpacing: 0.5,
        },
        headerRight: () => <NotificationBell />,
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessagesTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bellBtn: { marginRight: 16, position: 'relative' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 10 },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: 6,
    minWidth: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 8 },
});
