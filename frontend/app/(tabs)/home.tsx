import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, RefreshControl, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { TIER_INFO } from '@/constants/tiers';
import FeaturedJobsStrip from '@/components/FeaturedJobsStrip';
import InfoCard from '@/components/InfoCard';
import UsageBanner from '@/components/UsageBanner';
import { selectFeaturedJobs } from '@/src/utils/featuredJobs';
import { getMissingProfileItems } from '@/src/utils/profileCompleteness';

export default function HomeScreen() {
  const { jobs, currentUser, refreshJobs, refreshUsage } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const featured = useMemo(
    () => selectFeaturedJobs(jobs, currentUser ? { id: currentUser.id, trade: currentUser.trade } : null),
    [jobs, currentUser],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshJobs(), refreshUsage()]);
    } catch {
      // Keep showing the existing data if a refresh fails.
    } finally {
      setRefreshing(false);
    }
  }, [refreshJobs, refreshUsage]);

  if (!currentUser) return null;

  const tier = currentUser.subscription;
  const tierInfo = TIER_INFO[tier];
  const missing = getMissingProfileItems(currentUser);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>Morning, {currentUser.firstName}</Text>
        <Text style={styles.greetingSub}>{tierInfo.name} plan</Text>
      </View>

      {missing.length > 0 && (
        <InfoCard
          icon="account-alert-outline"
          title="Finish setting up your profile"
          body={`Missing: ${missing.join(', ')}`}
          ctaLabel="Edit profile"
          onPress={() => router.push('/edit-profile')}
        />
      )}

      <FeaturedJobsStrip jobs={featured} />
      <TouchableOpacity onPress={() => router.push('/(tabs)/jobs')} style={styles.seeAll}>
        <Text style={styles.seeAllText}>See all jobs →</Text>
      </TouchableOpacity>

      <InfoCard
        icon="briefcase-plus-outline"
        title="Need a tradesperson?"
        body="Post a job and get applications from local trades."
        ctaLabel="Post a job"
        onPress={() => router.push('/create-job')}
      />

      <InfoCard
        icon="crown-outline"
        title={`Your ${tierInfo.name} plan`}
        body={[
          `Payouts within ${tierInfo.paymentDays}`,
          `Job posts: ${tierInfo.posts}`,
          `Applications: ${tierInfo.applications}`,
        ]}
        ctaLabel={tier === 'gold' ? 'Manage plan' : 'Compare plans'}
        onPress={() => router.push('/subscription')}
      />

      <UsageBanner kind="applications" />
      <UsageBanner kind="posts" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  greeting: { paddingHorizontal: 16, paddingTop: 16 },
  greetingTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  greetingSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  seeAll: { paddingHorizontal: 16, paddingTop: 8 },
  seeAllText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
