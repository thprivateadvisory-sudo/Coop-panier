import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type ScanState = 'idle' | 'camera' | 'processing' | 'manual' | 'result';

type OcrResult = {
  store_name: string;
  total_amount: number;
  purchase_date: string;
  points_earned: number;
  confidence: number;
};

type Props = { navigation: any };

export function ScanReceiptScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [crediting, setCrediting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function handleCameraCapture() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra dans les réglages.');
        return;
      }
    }
    setState('camera');
  }

  async function handleGalleryPick() {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!picked.canceled && picked.assets[0]?.uri) {
        await processImage(picked.assets[0].uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accéder à la galerie.');
    }
  }

  async function takePicture() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setState('processing');
        await processImage(photo.uri);
      } else {
        Alert.alert('Erreur', 'La photo n\'a pas pu être prise. Réessayez.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
      setState('idle');
    }
  }

  async function processImage(uri: string) {
    setState('processing');
    setImageUri(uri);

    try {
      const fileName = `receipts/${profile?.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
        'process-receipt',
        { body: { image_url: publicUrl, contributor_id: profile?.id } }
      );

      if (ocrError) throw ocrError;

      setResult(ocrData as OcrResult);
      setState('result');
    } catch {
      // Fallback : saisie manuelle du montant
      setState('manual');
    }
  }

  async function confirmManual() {
    const amount = parseFloat(manualAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Montant invalide', 'Entrez un montant valide (ex : 24,50).');
      return;
    }

    const pointsEarned = Math.round(amount * 10);
    setCrediting(true);

    try {
      const { data: current } = await supabase
        .from('contributor_profiles')
        .select('points_total, tickets_scanned')
        .eq('profile_id', profile?.id)
        .single();

      await supabase
        .from('contributor_profiles')
        .update({
          points_total: (current?.points_total ?? 0) + pointsEarned,
          tickets_scanned: (current?.tickets_scanned ?? 0) + 1,
        })
        .eq('profile_id', profile?.id);
    } catch {}

    setCrediting(false);
    Alert.alert(
      '🎉 Bravo !',
      `Vous venez de gagner ${pointsEarned} points pour ${amount.toFixed(2)} € d'achats !`,
      [{ text: 'Super !', onPress: () => navigation.goBack() }]
    );
  }

  async function confirmReceipt() {
    if (!result) return;
    Alert.alert(
      '🎉 Bravo !',
      `Vous venez de gagner ${result.points_earned} points !`,
      [{ text: 'Super !', onPress: () => navigation.goBack() }]
    );
  }

  // ─── Camera ───────────────────────────────────────────────────────────────
  if (state === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.receiptFrame} />
            <Text style={styles.cameraHint}>Centrez votre ticket dans le cadre</Text>
          </View>
        </CameraView>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setState('idle')}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Processing ───────────────────────────────────────────────────────────
  if (state === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={colors.vert} />
        <Text style={styles.processingTitle}>Analyse en cours…</Text>
        <Text style={styles.processingSub}>Lecture de votre ticket</Text>
      </View>
    );
  }

  // ─── Manual entry (fallback) ───────────────────────────────────────────────
  if (state === 'manual') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Saisie du montant</Text>
            <Text style={styles.subtitle}>
              Entrez le total de votre ticket pour calculer vos points.{'\n'}
              1 € = 10 points.
            </Text>

            {!!imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}

            <View style={styles.manualCard}>
              <Text style={styles.manualLabel}>Total du ticket (€)</Text>
              <TextInput
                style={styles.manualInput}
                value={manualAmount}
                onChangeText={setManualAmount}
                placeholder="Ex : 24,50"
                placeholderTextColor={colors.grisClair}
                keyboardType="decimal-pad"
                returnKeyType="done"
                autoFocus
              />
              {!!manualAmount && !isNaN(parseFloat(manualAmount.replace(',', '.'))) && (
                <Text style={styles.pointsPreview}>
                  = {Math.round(parseFloat(manualAmount.replace(',', '.')) * 10)} points
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, crediting && { opacity: 0.6 }]}
              onPress={confirmManual}
              disabled={crediting}
              activeOpacity={0.85}
            >
              {crediting ? (
                <ActivityIndicator color={colors.blanc} />
              ) : (
                <Text style={styles.confirmBtnText}>Valider et créditer mes points</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setState('idle')}>
              <Text style={styles.retryText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Result (OCR success) ──────────────────────────────────────────────────
  if (state === 'result' && result) {
    const confidence = Math.round((result.confidence ?? 0) * 100);
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.resultTitle}>Ticket reconnu ✓</Text>

          <View style={styles.resultCard}>
            <ResultRow label="Magasin" value={result.store_name || 'Non détecté'} />
            <ResultRow label="Total" value={`${(result.total_amount ?? 0).toFixed(2)} €`} />
            <ResultRow label="Date" value={result.purchase_date || '—'} />
            <ResultRow label="Fiabilité OCR" value={`${confidence}%`} />
          </View>

          <View style={styles.pointsBanner}>
            <Text style={styles.pointsBannerLabel}>Points à créditer</Text>
            <Text style={styles.pointsBannerValue}>+{result.points_earned} pts</Text>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={confirmReceipt} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Valider et créditer mes points</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setState('idle')}>
            <Text style={styles.retryText}>Ce n'est pas bon ? Réessayer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Idle ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Scanner un ticket</Text>
        <Text style={styles.subtitle}>
          Photographiez votre ticket de caisse pour gagner des points.{'\n'}
          1 € d'achat = 10 points.
        </Text>

        <TouchableOpacity style={styles.mainOption} onPress={handleCameraCapture} activeOpacity={0.85}>
          <Text style={styles.mainOptionEmoji}>📸</Text>
          <Text style={styles.mainOptionTitle}>Prendre une photo</Text>
          <Text style={styles.mainOptionSub}>Utilisez l'appareil photo de votre téléphone</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryOption} onPress={handleGalleryPick} activeOpacity={0.85}>
          <Text style={styles.secondaryOptionEmoji}>🖼️</Text>
          <Text style={styles.secondaryOptionTitle}>Importer depuis la galerie</Text>
        </TouchableOpacity>

        <View style={styles.tipsBox}>
          <Text style={styles.tipsTitle}>Pour une meilleure reconnaissance</Text>
          {[
            'Ticket bien aplati et éclairé',
            'Total clairement visible',
            'Évitez les ombres et reflets',
          ].map((tip) => (
            <Text key={tip} style={styles.tip}>· {tip}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },

  backBtn: { marginBottom: spacing.sm },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.vert },
  title: { fontFamily: 'Nunito_900Black', fontSize: 28, color: colors.gris },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.grisMoyen, lineHeight: 22 },

  mainOption: {
    backgroundColor: colors.vert,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  mainOptionEmoji: { fontSize: 48 },
  mainOptionTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: colors.blanc },
  mainOptionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },

  secondaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  secondaryOptionEmoji: { fontSize: 24 },
  secondaryOptionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.gris },

  tipsBox: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tipsTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.vert,
    marginBottom: spacing.xs,
  },
  tip: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  receiptFrame: {
    width: 280,
    height: 400,
    borderWidth: 2,
    borderColor: colors.orange,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cameraHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.blanc,
    textAlign: 'center',
  },
  cameraControls: {
    backgroundColor: '#000',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.blanc,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.blanc,
  },
  cancelBtn: { padding: spacing.sm },
  cancelText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.7)' },

  // Processing
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fond,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  processingTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: colors.gris },
  processingSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },

  // Manual entry
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.bordure,
  },
  manualCard: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  manualLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: colors.grisMoyen,
  },
  manualInput: {
    borderWidth: 1.5,
    borderColor: colors.vert,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: colors.gris,
    textAlign: 'center',
  },
  pointsPreview: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.vert,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Result
  resultTitle: { fontFamily: 'Nunito_900Black', fontSize: 26, color: colors.vert },
  resultCard: {
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  resultLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen },
  resultValue: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.gris },
  pointsBanner: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  pointsBannerLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.grisMoyen },
  pointsBannerValue: { fontFamily: 'Nunito_900Black', fontSize: 40, color: colors.vert },

  confirmBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.blanc },
  retryText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },
});
