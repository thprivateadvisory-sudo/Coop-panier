import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '@/utils/theme';

type Props = { title: string; onBack: () => void };

export function ScreenHeader({ title, onBack }: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Retour</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.md },
  back: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.vert },
  title: { fontFamily: 'Nunito_900Black', fontSize: 26, color: colors.gris },
});
