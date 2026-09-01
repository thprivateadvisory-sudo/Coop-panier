import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import type { SubscriptionTier } from '@/types';

type Plan = {
  id: SubscriptionTier;
  name: string;
  price: string;
  priceNum: number;
  multiplier: string;
  color: string;
  features: string[];
  stripePriceId: string;
};

const plans: Plan[] = [
  {
    id: 'essentiel',
    name: 'Essentiel',
    price: '4,99€/mois',
    priceNum: 4.99,
    multiplier: '×1,5 points',
    color: colors.vert,
    stripePriceId: 'price_essentiel_monthly',
    features: [
      '1,5× points sur chaque ticket scanné',
      'Badge contributeur dans l\'appli',
      'Résumé mensuel d\'impact',
      'Accès prioritaire aux nouvelles villes',
    ],
  },
  {
    id: 'engagement',
    name: 'Engagement',
    price: '9,99€/mois',
    priceNum: 9.99,
    multiplier: '×2 points',
    color: colors.orange,
    stripePriceId: 'price_engagement_monthly',
    features: [
      '2× points sur chaque ticket scanné',
      'Badge ambassadeur doré',
      'Rapport d\'impact trimestriel',
      '50 points bonus par parrainage',
      'Accès à l\'association partenaire locale',
    ],
  },
];

type Props = { navigation: any };

export function SubscriptionsScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);

  async function handleSubscribe(plan: Plan) {
    setLoading(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          profile_id: profile?.id,
          price_id: plan.stripePriceId,
          tier: plan.id,
        },
      });

      if (error) throw error;

      Alert.alert(
        'Paiement sécurisé',
        `Vous allez être redirigé vers la page de paiement Stripe pour l'abonnement ${plan.name}.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Continuer', onPress: () => Linking.openURL(data.url) },
        ]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible de lancer le paiement. Réessayez.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Choisissez votre plan</Text>
        <Text style={styles.subtitle}>
          Multipliez votre impact en gagnant plus de points sur chaque ticket.
        </Text>

        {plans.map((plan) => (
          <View key={plan.id} style={[styles.planCard, { borderColor: plan.color }]}>
            <View style={[styles.planHeader, { backgroundColor: plan.color }]}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planMultiplier}>{plan.multiplier}</Text>
              </View>
              <Text style={styles.planPrice}>{plan.price}</Text>
            </View>

            <View style={styles.planFeatures}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Text style={[styles.featureCheck, { color: plan.color }]}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.subscribeBtn, { backgroundColor: plan.color }]}
              onPress={() => handleSubscribe(plan)}
              disabled={loading !== null}
              activeOpacity={0.85}
            >
              {loading === plan.id ? (
                <ActivityIndicator color={colors.blanc} />
              ) : (
                <Text style={styles.subscribeBtnText}>S'abonner — {plan.price}</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.freeCard}>
          <Text style={styles.freePlanTitle}>Gratuit — toujours</Text>
          <Text style={styles.freePlanDesc}>
            Sans abonnement, vous gagnez 1 point par euro d'achat scanné.
            Vous pouvez financer des paniers à votre rythme.
          </Text>
        </View>

        <Text style={styles.legalNote}>
          Abonnement mensuel. Résiliable à tout moment depuis les paramètres.
          Paiement sécurisé par Stripe. Aucun engagement.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  back: { marginBottom: spacing.sm },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.vert },
  title: { fontFamily: 'Nunito_900Black', fontSize: 28, color: colors.gris },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.grisMoyen, lineHeight: 22 },

  planCard: {
    borderWidth: 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.blanc,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  planName: {
    fontFamily: 'Nunito_900Black',
    fontSize: 20,
    color: colors.blanc,
  },
  planMultiplier: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  planPrice: {
    fontFamily: 'Nunito_900Black',
    fontSize: 18,
    color: colors.blanc,
  },
  planFeatures: { padding: spacing.lg, gap: spacing.sm },
  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  featureCheck: { fontWeight: '800', fontSize: 15, marginTop: 1 },
  featureText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.gris, flex: 1, lineHeight: 20 },
  subscribeBtn: {
    margin: spacing.md,
    marginTop: 0,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscribeBtnText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: colors.blanc,
  },

  freeCard: {
    backgroundColor: colors.fond,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  freePlanTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.gris,
  },
  freePlanDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.grisMoyen,
    lineHeight: 20,
  },

  legalNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.grisClair,
    textAlign: 'center',
    lineHeight: 16,
  },
});
