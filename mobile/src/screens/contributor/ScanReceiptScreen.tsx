import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type ScanState = 'idle' | 'camera' | 'processing' | 'result';

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
  const cameraRef = useRef<CameraView>(null);

  async function handleCameraCapture() {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    setState('camera');
  }

  async function handleGalleryPick() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!picked.canceled && picked.assets[0]) {
      await processImage(picked.assets[0].uri);
    }
  }

  async function takePicture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      setState('processing');
      await processImage(photo.uri);
    }
  }

  async function processImage(uri: string) {
    setState('processing');
    try {
      // Upload image to Supabase Storage
      const fileName = `receipts/${profile?.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Appel à la Edge Function OCR
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
        'process-receipt',
        { body: { image_url: publicUrl, contributor_id: profile?.id } }
      );

      if (ocrError) throw ocrError;

      setResult(ocrData as OcrResult);
      setState('result');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de traiter ce ticket. Vérifiez la photo et réessayez.');
      setState('idle');
    }
  }

  async function confirmReceipt() {
    if (!result) return;
    // Les points sont déjà crédités par la Edge Function
    Alert.alert(
      '🎉 Bravo !',
      `Vous venez de gagner ${result.points_earned} points !`,
      [{ text: 'Super !', onPress: () => navigation.goBack() }]
    );
  }

  if (state === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.receiptFrame} />
            <Text style={styles.cameraHint}>
              Centrez votre ticket dans le cadre
            </Text>
          </View>
        </CameraView>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setState('idle')}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={colors.vert} />
        <Text style={styles.processingTitle}>Analyse en cours…</Text>
        <Text style={styles.processingSub}>
          Notre OCR lit votre ticket et calcule vos points
        </Text>
      </View>
    );
  }

  if (state === 'result' && result) {
    const confidence = Math.round(result.confidence * 100);
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.resultTitle}>Ticket reconnu ✓</Text>

          <View style={styles.resultCard}>
            <ResultRow label="Magasin" value={result.store_name || 'Non détecté'} />
            <ResultRow label="Total" value={`${result.total_amount?.toFixed(2)} €`} />
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Scanner un ticket</Text>
        <Text style={styles.subtitle}>
          Photographiez votre ticket de caisse pour gagner des points.
          1€ d'achat = 10 points.
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
  scroll: { padding: spacing.xl, gap: spacing.lg },

  backBtn: { marginBottom: spacing.sm },
  backText: { fontFamily: 'Inter-Regular', fontSize: 15, color: colors.vert },
  title: { fontFamily: 'Nunito-Black', fontSize: 28, color: colors.gris },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 15, color: colors.grisMoyen, lineHeight: 22 },

  mainOption: {
    backgroundColor: colors.vert,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  mainOptionEmoji: { fontSize: 48 },
  mainOptionTitle: {
    fontFamily: 'Nunito-ExtraBold',
    fontSize: 18,
    color: colors.blanc,
  },
  mainOptionSub: {
    fontFamily: 'Inter-Regular',
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
  secondaryOptionTitle: {
    fontFamily: 'Nunito-Bold',
    fontSize: 15,
    color: colors.gris,
  },

  tipsBox: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tipsTitle: {
    fontFamily: 'Nunito-Bold',
    fontSize: 13,
    color: colors.vert,
    marginBottom: spacing.xs,
  },
  tip: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.grisMoyen },

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
    fontFamily: 'Inter-Regular',
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
  cancelText: { fontFamily: 'Inter-Regular', fontSize: 15, color: 'rgba(255,255,255,0.7)' },

  // Processing
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fond,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  processingTitle: {
    fontFamily: 'Nunito-ExtraBold',
    fontSize: 22,
    color: colors.gris,
  },
  processingSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },

  // Result
  resultTitle: {
    fontFamily: 'Nunito-Black',
    fontSize: 26,
    color: colors.vert,
  },
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
  resultLabel: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.grisMoyen },
  resultValue: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.gris },
  pointsBanner: {
    backgroundColor: colors.vertPale,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  pointsBannerLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: colors.grisMoyen,
  },
  pointsBannerValue: {
    fontFamily: 'Nunito-Black',
    fontSize: 40,
    color: colors.vert,
  },
  confirmBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Nunito-ExtraBold',
    fontSize: 16,
    color: colors.blanc,
  },
  retryText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },
});
