import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { ScreenHeader } from './ScreenHeader';

type Props = { navigation: any };

export function ReferralScreen({ navigation }: Props) {
  const profileId = useAuthStore((s) => s.profile?.id);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('contributor_profiles')
          .select('referral_code')
          .eq('profile_id', profileId)
          .maybeSingle();
        setCode((data as { referral_code?: string } | null)?.referral_code ?? null);
      } catch {
        setCode(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  async function handleShare() {
    if (!code) return;
    try {
      await Share.share({
        message:
          `Rejoins-moi sur Coop'Panier ! Scanne tes tickets de caisse et aide à financer des paniers ` +
          `pour les familles dans le besoin. Avec mon code ${code}, tu reçois 50 points offerts ` +
          `à l'inscription : https://www.cooppanier.fr`,
      });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le partage.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Parrainer un ami" onBack={() => navigation.goBack()} />

        <Text style={styles.intro}>
          Invitez vos proches : plus nous sommes nombreux, plus nous finançons de paniers.
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Votre code de parrainage</Text>
          {loading ? (
            <ActivityIndicator color={colors.vert} />
          ) : code ? (
            <Text style={styles.code} selectable>{code}</Text>
          ) : (
            <Text style={styles.noCode}>Code indisponible pour le moment.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.shareBtn, !code && { opacity: 0.4 }]}
          onPress={handleShare}
          disabled={!code}
          activeOpacity={0.85}
        >
          <Text style={styles.shareText}>Partager mon code</Text>
        </TouchableOpacity>

        <View style={styles.howCard}>
          <Text style={styles.howTitle}>Comment ça marche ?</Text>
          <Step n="1" text="Partagez votre code à un ami." />
          <Step n="2" text="Il le saisit lors de son inscription comme contributeur." />
          <Step n="3" text="Vous recevez 100 points, et lui 50 points de bienvenue." />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.grisMoyen, lineHeight: 22 },
  codeCard: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.vert,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.vert, textTransform: 'uppercase' },
  code: { fontFamily: 'Nunito_900Black', fontSize: 36, color: colors.vert, letterSpacing: 6 },
  noCode: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen },
  shareBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.blanc },
  howCard: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
    gap: spacing.md,
  },
  howTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.gris },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.vertPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: colors.vert },
  stepText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen, lineHeight: 20 },
});
