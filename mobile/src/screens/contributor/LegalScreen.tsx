import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { ScreenHeader } from './ScreenHeader';

const SITE = 'https://www.cooppanier.fr';
const CONTACT = 'contact@cooppanier.fr';

const LINKS = [
  { emoji: '🔒', label: 'Politique de confidentialité', url: `${SITE}/privacy.html` },
  { emoji: '🗑️', label: 'Supprimer mon compte et mes données', url: `${SITE}/delete-account.html` },
  { emoji: '🌐', label: 'Site web Coop\'Panier', url: SITE },
  { emoji: '✉️', label: `Nous contacter (${CONTACT})`, url: `mailto:${CONTACT}` },
];

type Props = { navigation: any };

export function LegalScreen({ navigation }: Props) {
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erreur', `Impossible d'ouvrir ${url}`);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Mentions légales" onBack={() => navigation.goBack()} />

        <View style={styles.menu}>
          {LINKS.map((l, i) => (
            <TouchableOpacity
              key={l.url}
              style={[styles.row, i === LINKS.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => open(l.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{l.emoji}</Text>
              <Text style={styles.label}>{l.label}</Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footer}>
          Coop'Panier — version {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  menu: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  emoji: { fontSize: 20 },
  label: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.gris },
  arrow: { fontSize: 22, color: colors.grisClair },
  footer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.grisClair,
    textAlign: 'center',
    lineHeight: 18,
  },
});
