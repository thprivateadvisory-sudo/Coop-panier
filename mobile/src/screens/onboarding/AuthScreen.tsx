import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import type { UserRole } from '@/types';

type Mode = 'login' | 'signup';

type Props = {
  route: { params: { role: UserRole } };
  navigation: any;
};

export function AuthScreen({ route, navigation }: Props) {
  const role = route?.params?.role ?? 'contributor';
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roleLabel = {
    contributor: 'Contributeur',
    beneficiary: 'Bénéficiaire',
    association: 'Association',
  }[role];

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Champs manquants', 'Remplissez votre email et mot de passe.');
      return;
    }
    if (mode === 'signup' && !fullName) {
      Alert.alert('Champs manquants', 'Indiquez votre prénom et nom.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Mot de passe trop court', 'Au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await handleSignUp();
      } else {
        await handleSignIn();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Alert.alert('Erreur', error.message); return; }
    if (!data.user) return;

    // Créer le profil
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
    });
    if (profileError) { Alert.alert('Erreur', profileError.message); return; }

    // Créer le sous-profil selon le rôle
    if (role === 'contributor') {
      await supabase.from('contributor_profiles').insert({ profile_id: data.user.id });
    } else if (role === 'beneficiary') {
      await supabase.from('beneficiary_profiles').insert({ profile_id: data.user.id });
    } else if (role === 'association') {
      await supabase.from('association_profiles').insert({
        profile_id: data.user.id,
        association_name: fullName,
        address: '',
        city: '',
        postal_code: '',
      });
    }

    Alert.alert(
      'Compte créé !',
      'Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.',
      [{ text: 'OK', onPress: () => setMode('login') }]
    );
  }

  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert(
        'Connexion impossible',
        error.message.includes('Invalid') ? 'Email ou mot de passe incorrect.' : error.message
      );
    }
    // La navigation se fait automatiquement via le listener auth dans Navigation
  }

  async function handleMagicLink() {
    if (!email) { Alert.alert('Email requis', 'Entrez votre email d\'abord.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    Alert.alert('Lien envoyé !', `Un lien de connexion a été envoyé à ${email}. Cliquez dessus pour accéder à votre compte.`);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>

          {/* Toggle login/signup */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
                Inscription
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
                Connexion
              </Text>
            </TouchableOpacity>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>Prénom et nom</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jean Dupont"
                  placeholderTextColor={colors.grisClair}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.fr"
                placeholderTextColor={colors.grisClair}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="8 caractères minimum"
                  placeholderTextColor={colors.grisClair}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.blanc} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Magic link */}
          <TouchableOpacity
            style={styles.magicBtn}
            onPress={handleMagicLink}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.magicBtnText}>✉️  Recevoir un lien par email</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            En créant un compte, vous acceptez nos{' '}
            <Text style={styles.legalLink}>Conditions d'utilisation</Text>
            {' '}et notre{' '}
            <Text style={styles.legalLink}>Politique de confidentialité</Text>.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.blanc },
  scroll: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1 },

  back: { marginBottom: spacing.sm },
  backText: { fontFamily: 'Inter', fontSize: 15, color: colors.vert },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  title: { fontFamily: 'Nunito', fontWeight: '900', fontSize: 28, color: colors.gris },
  roleBadge: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleBadgeText: { fontFamily: 'Inter', fontWeight: '600', fontSize: 12, color: colors.vert },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.fond,
    borderRadius: radius.md,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  toggleBtnActive: { backgroundColor: colors.blanc },
  toggleText: { fontFamily: 'Nunito', fontWeight: '700', fontSize: 14, color: colors.grisMoyen },
  toggleTextActive: { color: colors.gris },

  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 12,
    color: colors.grisMoyen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.bordure,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: 'Inter',
    fontSize: 15,
    color: colors.gris,
    backgroundColor: colors.blanc,
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  eyeIcon: { fontSize: 18 },

  submitBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitText: { fontFamily: 'Nunito', fontWeight: '800', fontSize: 16, color: colors.blanc },

  separator: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.bordure },
  separatorText: { fontFamily: 'Inter', fontSize: 13, color: colors.grisClair },

  magicBtn: {
    borderWidth: 1.5,
    borderColor: colors.bordure,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  magicBtnText: { fontFamily: 'Nunito', fontWeight: '700', fontSize: 14, color: colors.gris },

  legal: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: colors.grisClair,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  legalLink: { color: colors.vert, textDecorationLine: 'underline' },
});
