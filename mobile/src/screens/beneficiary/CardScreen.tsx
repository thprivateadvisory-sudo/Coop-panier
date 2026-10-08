import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import type { BeneficiaryProfile, PickupPoint } from '@/types';

const { width: screenWidth } = Dimensions.get('window');

export function BeneficiaryCardScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [beneficiary, setBeneficiary] = useState<BeneficiaryProfile | null>(null);
  const [pickupPoint, setPickupPoint] = useState<PickupPoint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      const { data } = await supabase
        .from('beneficiary_profiles')
        .select('*')
        .eq('profile_id', profile!.id)
        .single();

      if (data) {
        setBeneficiary(data);
        if (data.pickup_point_id) {
          const { data: pp } = await supabase
            .from('pickup_points')
            .select('*')
            .eq('id', data.pickup_point_id)
            .single();
          if (pp) setPickupPoint(pp);
        }
      }
      setLoading(false);
    }

    load();

    // Mise à jour temps réel du statut de la carte
    const channel = supabase
      .channel(`beneficiary_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'beneficiary_profiles',
          filter: `profile_id=eq.${profile.id}`,
        },
        (payload) => setBeneficiary(payload.new as BeneficiaryProfile)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.vert} />
      </View>
    );
  }

  if (!beneficiary) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🧺</Text>
          <Text style={styles.emptyTitle}>Inscription en cours</Text>
          <Text style={styles.emptySub}>
            Votre dossier est en cours d'examen. Vous recevrez une notification
            dès que votre carte sera activée.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = beneficiary.status === 'active';
  const isWaitlist = beneficiary.status === 'waitlist';

  const qrPayload = JSON.stringify({
    id: beneficiary.profile_id,
    qr: beneficiary.qr_code,
    ts: Date.now(),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Ma carte</Text>

        {/* Carte principale */}
        <View style={[styles.card, isWaitlist && styles.cardWaitlist]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardName} numberOfLines={1}>{profile?.full_name}</Text>
              <View style={[styles.statusBadge, isActive && styles.statusActive, isWaitlist && styles.statusWaitlist]}>
                <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotWaitlist]} />
                <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextWaitlist]}>
                  {isActive ? 'Carte active' : 'Liste d\'attente'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardLogo}>Coop'Panier</Text>
          </View>

          {isActive ? (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrPayload}
                size={Math.min(200, screenWidth - 120)}
                color={colors.gris}
                backgroundColor={colors.blanc}
              />
              <Text style={styles.qrHint}>
                Présentez ce code à votre point de retrait
              </Text>
            </View>
          ) : (
            <View style={styles.waitlistInfo}>
              <Text style={styles.waitlistEmoji}>⏳</Text>
              <Text style={styles.waitlistText}>
                Votre demande est en cours de traitement.
                Une association partenaire va bientôt vous contacter.
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>
              Paniers reçus : {beneficiary.baskets_received}
            </Text>
            {beneficiary.next_pickup_date && (
              <Text style={styles.cardFooterText}>
                Prochain retrait : {new Date(beneficiary.next_pickup_date).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
        </View>

        {/* Point de retrait */}
        {pickupPoint && (
          <View style={styles.pickupCard}>
            <Text style={styles.pickupTitle}>Votre point de retrait</Text>
            <Text style={styles.pickupName}>{pickupPoint.name}</Text>
            <Text style={styles.pickupAddress}>
              {pickupPoint.address}, {pickupPoint.postal_code} {pickupPoint.city}
            </Text>

            <View style={styles.hoursGrid}>
              {Object.entries(pickupPoint.opening_hours).map(([day, hours]) => (
                <View key={day} style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>{day}</Text>
                  <Text style={styles.hoursValue}>{hours}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Comment ça marche ?</Text>
          {[
            'Présentez votre QR code à l\'association partenaire',
            'L\'association valide la remise du panier',
            'Votre compteur de paniers se met à jour automatiquement',
          ].map((step, i) => (
            <Text key={i} style={styles.infoStep}>{i + 1}. {step}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  pageTitle: {
    fontFamily: 'Nunito_900Black',
    fontSize: 28,
    color: colors.gris,
  },

  card: {
    backgroundColor: colors.vert,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  cardWaitlist: { backgroundColor: colors.grisMoyen },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.blanc,
    marginBottom: spacing.sm,
  },
  cardLogo: {
    fontFamily: 'Nunito_900Black',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  statusActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statusWaitlist: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 6, height: 6, borderRadius: radius.full },
  statusDotActive: { backgroundColor: '#4ADE80' },
  statusDotWaitlist: { backgroundColor: '#FCD34D' },
  statusText: { fontFamily: 'Inter_400Regular', fontSize: 12, fontWeight: '500' },
  statusTextActive: { color: '#4ADE80' },
  statusTextWaitlist: { color: '#FCD34D' },

  qrContainer: {
    alignItems: 'center',
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.md,
  },
  qrHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.grisMoyen,
    textAlign: 'center',
  },

  waitlistInfo: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  waitlistEmoji: { fontSize: 48 },
  waitlistText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  cardFooterText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  pickupCard: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pickupTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: colors.grisMoyen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickupName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: colors.gris },
  pickupAddress: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen },
  hoursGrid: { marginTop: spacing.sm, gap: 4 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hoursDay: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen },
  hoursValue: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.gris, fontWeight: '500' },

  infoBox: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  infoTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: colors.vert,
  },
  infoStep: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen, lineHeight: 20 },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontFamily: 'Nunito_900Black', fontSize: 24, color: colors.gris },
  emptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: colors.grisMoyen,
    textAlign: 'center',
    lineHeight: 22,
  },
});
