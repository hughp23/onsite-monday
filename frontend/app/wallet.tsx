import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

export default function WalletScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Wallet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.text,
  },
});
