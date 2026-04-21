import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import { AuthContextProvider } from '@/context/AuthContext';
import { AppContextProvider } from '@/context/AppContext';
import { colors } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Don't return null — SplashScreen.preventAutoHideAsync() keeps the splash
  // visible while fonts load, so there's no need to block rendering here.
  // Returning null would tear down Expo Router's navigation context and break GO_BACK.

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthContextProvider>
        <AppContextProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.white,
              headerTitleStyle: {
                fontFamily: 'BarlowCondensed_800ExtraBold',
                fontSize: 22,
                letterSpacing: 0.5,
              },
              contentStyle: { backgroundColor: colors.background },
              headerShadowVisible: true,
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
            <Stack.Screen name="job-applicants/[id]" options={{ title: 'Applicants', headerBackTitle: 'Back' }} />
          </Stack>
        </AppContextProvider>
        </AuthContextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
