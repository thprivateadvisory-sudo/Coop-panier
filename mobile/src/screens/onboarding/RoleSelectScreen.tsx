import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import type { UserRole } from '@/types';

const roles: { id: UserRole; emoji: string; title: string; desc: string }[] = [
  {
    id: 'contributor',
    emoji: '🛒',
    title: 'Contributeur',
    desc: 'Je scanne mes tickets et finance des paniers pour les familles dans le besoin.',
  },
  {
    id: 'beneficiary',
    emoji: '🧺',
    title: 'Bénéficiaire',
    desc: 'Je souhaite recevoir une aide alimentaire via une association partenaire.',
  },
  {
    id: 'association',
    emoji: '🤝',
    title: 'Association',
    desc: 'Je gère un point de distribution et valide la remise des paniers.',
  },
];

type Props = {
  navigation: any;
};

export function RoleSelectScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  function handleContinue() {
    if (!selected) return;
    if (selected === 'contributor') navigation.navigate('AuthStack', { role: selected });
    else if (selected === 'beneficiary') navigation.navigate('AuthStack', { role: selected });
    else navigation.navigate('AuthStack', { role: selected });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline}>Je suis…</Text>
        <Text style={styles.sub}>
          Choisissez votre profil pour accéder aux bonnes fonctionnalités.
        </Text>

        <View style={styles.cards}>
          {roles.map((role) => {
            const isActive = selected === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.card, isActive && styles.cardActive]}
                onPress={() => setSelected(role.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.cardEmoji}>{role.emoji}</Text>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, isActive && styles.cardTitleActive]}>
                    {role.title}
                  </Text>
                  <Text style={styles.cardDesc}>{role.desc}</Text>
                </View>
                <View style={[styles.radio, isActive && styles.radioActive]}>
                  {isActive && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!selected || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.blanc} />
          ) : (
            <Text style={styles.btnText}>Continuer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.blanc },
  content: { padding: spacing.xl, gap: spacing.lg },
  headline: {
    fontFamily: 'Nunito',
    fontWeight: '900',
    fontSize: 32,
    color: colors.gris,
    marginTop: spacing.xl,
  },
  sub: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: colors.grisMoyen,
    lineHeight: 22,
  },
  cards: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.bordure,
    backgroundColor: colors.fond,
  },
  cardActive: {
    borderColor: colors.vert,
    backgroundColor: colors.vertPale,
  },
  cardEmoji: { fontSize: 36 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 16,
    color: colors.gris,
  },
  cardTitleActive: { color: colors.vert },
  cardDesc: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: colors.grisMoyen,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.bordure,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.vert },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.vert,
  },
  btn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 16,
    color: colors.blanc,
  },
});
