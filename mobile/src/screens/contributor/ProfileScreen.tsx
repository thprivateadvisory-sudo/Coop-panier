import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useContributorProfile } from '@/hooks/useContributorProfile';

const SUBSCRIPTION_LABELS = {
  free: { label: 'Gratuit', color: colors.grisMoyen, bg: colors.fond },
  essentiel: { label: 'Essentiel', color: colors.vert, bg: colors.vertPale },
  engagement: { label: 'Engagement', color: colors.orange, bg: colors.orangePale },
};

type Props = { navigation: any };

export function ProfileScreen({ navigation }: Props) {
  const { profile, setProfile, signOut } = useAuthStore();
  const contributor = useContributorProfile(profile?.id ?? '');

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [saving, setSaving] = useState(false);

  const tier = contributor?.subscription_tier ?? 'free';
  const subStyle = SUBSCRIPTION_LABELS[tier];
  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSave() {
    if (!fullName.trim()) { Alert.alert('Erreur', 'Le nom ne peut pas être vide.'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), city: city.trim() })
      .eq('id', profile!.id)
      .select()
      .single();
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setProfile(data);
    setEditing(false);
  }

  function handleSignOut() {
    Alert.alert(
      'Se déconnecter',
      'Vous allez quitter votre compte.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: signOut },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {!editing ? (
            <View style={styles.nameBlock}>
              <Text style={styles.name}>{profile?.full_name}</Text>
              <Text style={styles.email}>{profile?.email}</Text>
              {profile?.city ? <Text style={styles.city}>📍 {profile.city}</Text> : null}
            </View>
          ) : (
            <View style={styles.editBlock}>
              <TextInput
                style={styles.editInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Prénom et nom"
                placeholderTextColor={colors.grisClair}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.editInput}
                value={city}
                onChangeText={setCity}
                placeholder="Votre ville"
                placeholderTextColor={colors.grisClair}
                autoCapitalize="words"
              />
            </View>
          )}

          {!editing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.blanc} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditing(false); setFullName(profile?.full_name ?? ''); setCity(profile?.city ?? ''); }}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Abonnement */}
        <View style={[styles.subCard, { borderColor: subStyle.color, backgroundColor: subStyle.bg }]}>
          <View>
            <Text style={styles.subLabel}>Abonnement actuel</Text>
            <Text style={[styles.subTier, { color: subStyle.color }]}>{subStyle.label}</Text>
            {contributor?.subscription_expires_at && (
              <Text style={styles.subExpiry}>
                Expire le {new Date(contributor.subscription_expires_at).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
          {tier === 'free' && (
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.vert }]}
              onPress={() => navigation.navigate('Subscriptions')}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeBtnText}>Passer à l'Essentiel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox value={contributor?.points_total ?? 0} label="Points cumulés" />
          <StatBox value={contributor?.tickets_scanned ?? 0} label="Tickets scannés" />
          <StatBox value={contributor?.baskets_funded ?? 0} label="Paniers financés" />
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem emoji="📋" label="Historique des transactions" onPress={() => {}} />
          <MenuItem emoji="🔔" label="Notifications" onPress={() => {}} />
          <MenuItem emoji="🔒" label="Changer le mot de passe" onPress={handleChangePassword} />
          <MenuItem emoji="🤝" label="Parrainer un ami" onPress={() => {}} />
          <MenuItem emoji="📄" label="Mentions légales" onPress={() => {}} />
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Coop'Panier v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );

  async function handleChangePassword() {
    if (!profile?.email) return;
    Alert.alert(
      'Réinitialiser le mot de passe',
      `Un email de réinitialisation sera envoyé à ${profile.email}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            await supabase.auth.resetPasswordForEmail(profile.email);
            Alert.alert('Email envoyé', 'Vérifiez votre boîte mail.');
          },
        },
      ]
    );
  }
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value.toLocaleString('fr-FR')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    backgroundColor: colors.blanc,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.vert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Nunito_900Black', fontSize: 26, color: colors.blanc },
  nameBlock: { alignItems: 'center', gap: 4 },
  name: { fontFamily: 'Nunito_800ExtraBold', fontSize: 20, color: colors.gris },
  email: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen },
  city: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen, marginTop: 2 },

  editBlock: { width: '100%', gap: spacing.sm },
  editInput: {
    borderWidth: 1.5,
    borderColor: colors.bordure,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: colors.gris,
    textAlign: 'center',
  },
  editActions: { alignItems: 'center', gap: spacing.sm },
  editBtn: {
    borderWidth: 1.5,
    borderColor: colors.bordure,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
  },
  editBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.gris },
  saveBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    minWidth: 140,
    alignItems: 'center',
  },
  saveBtnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: colors.blanc },
  cancelText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen },

  subCard: {
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.grisMoyen, marginBottom: 2 },
  subTier: { fontFamily: 'Nunito_900Black', fontSize: 20 },
  subExpiry: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.grisMoyen, marginTop: 2 },
  upgradeBtn: {
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  upgradeBtnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: colors.blanc },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontFamily: 'Nunito_900Black', fontSize: 20, color: colors.vert },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.grisMoyen, textAlign: 'center' },

  menu: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  menuEmoji: { fontSize: 20 },
  menuLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.gris },
  menuArrow: { fontSize: 20, color: colors.grisClair },

  signOutBtn: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: colors.error },

  version: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.grisClair,
    textAlign: 'center',
  },
});
