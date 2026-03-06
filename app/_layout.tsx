import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AppContextProvider } from '@/context/AppContext';
import { colors } from '@/constants/colors';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppContextProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.white,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="job/[id]" options={{ title: 'Job Details', headerBackTitle: 'Back' }} />
            <Stack.Screen name="person/[id]" options={{ title: 'Profile', headerBackTitle: 'Back' }} />
            <Stack.Screen name="chat/[id]" options={{ headerBackTitle: 'Back' }} />
            <Stack.Screen name="create-job" options={{ title: 'Post a Job', presentation: 'modal' }} />
            <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
            <Stack.Screen name="subscription" options={{ title: 'Choose Your Plan', presentation: 'modal' }} />
            <Stack.Screen name="review/[jobId]" options={{ title: 'Rate Your Experience', presentation: 'modal' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          </Stack>
        </AppContextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
