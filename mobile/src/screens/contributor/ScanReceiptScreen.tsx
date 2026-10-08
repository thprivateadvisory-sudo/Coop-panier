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
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';

// Même API que l'application web (OCR + crédit des points côté serveur)
const API_URL = 'https://coop-panier.vercel.app/api';

type ScanState = 'idle' | 'camera' | 'processing' | 'result' | 'submitting';

type OcrResult = {
  storeName: string | null;
  detectedAmount: number | null;
  purchaseDate: string | null;
  confidence: number | null;
  imageUrl: string | null;
  amountToken: string | null;
};

type Props = { navigation: any };

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function ScanReceiptScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  async function handleCameraCapture() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Caméra refusée', 'Autorisez la caméra dans les réglages, ou importez une photo depuis la galerie.');
        return;
      }
    }
    setState('camera');
  }

  async function handleGalleryPick() {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!picked.canceled && picked.assets?.[0]) {
        await processImage(picked.assets[0].uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
    }
  }

  async function takePicture() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (photo?.uri) await processImage(photo.uri);
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo. Réessayez.');
      setState('idle');
    }
  }

  async function processImage(uri: string) {
    setState('processing');
    try {
      // Réduire la taille de l'image avant envoi (limite de taille côté serveur)
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!resized.base64) throw new Error('image');

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        resized.base64
      );
      setImageHash(hash);

      const token = await getAccessToken();
      const { data: { session } } = await supabase.auth.getSession();
      if (!token || !session) throw new Error('auth');

      const resp = await fetch(`${API_URL}/scan-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          imageBase64: `data:image/jpeg;base64,${resized.base64}`,
          contributorId: session.user.id,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error ?? 'scan');

      if (data.detectedAmount == null || !data.amountToken) {
        Alert.alert(
          'Montant illisible',
          'Nous n\'avons pas pu lire le total du ticket. Reprenez la photo avec le total bien visible.'
        );
        setState('idle');
        return;
      }

      setResult(data as OcrResult);
      setState('result');
    } catch {
      Alert.alert('Erreur', 'Impossible de traiter ce ticket. Vérifiez la photo et votre connexion, puis réessayez.');
      setState('idle');
    }
  }

  async function confirmReceipt() {
    if (!result?.detectedAmount || !result.amountToken) return;
    setState('submitting');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('auth');

      const resp = await fetch(`${API_URL}/submit-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          detectedAmount: result.detectedAmount,
          amountToken: result.amountToken,
          imageHash,
          imageUrl: result.imageUrl || null,
          storeName: result.storeName ?? null,
          purchaseDate: result.purchaseDate ?? null,
          ocrConfidence: result.confidence ?? null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        Alert.alert('Ticket refusé', data?.error ?? 'Erreur lors de la validation.');
        setState('result');
        return;
      }

      setResult(null);
      setState('idle');
      Alert.alert(
        '🎉 Bravo !',
        `Vous venez de gagner ${data.earned} points !`,
        [{ text: 'Super !', onPress: () => navigation.navigate('Home') }]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible de valider le ticket. Vérifiez votre connexion et réessayez.');
      setState('result');
    }
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

  if (state === 'processing' || state === 'submitting') {
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
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.resultTitle}>Ticket reconnu ✓</Text>

          <View style={styles.resultCard}>
            <ResultRow label="Magasin" value={result.storeName || 'Non détecté'} />
            <ResultRow label="Total" value={`${(result.detectedAmount ?? 0).toFixed(2)} €`} />
            <ResultRow label="Date" value={result.purchaseDate || '—'} />
            {result.confidence != null && (
              <ResultRow label="Fiabilité OCR" value={`${Math.round(result.confidence * 100)}%`} />
            )}
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={confirmReceipt} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Valider et créditer mes points</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setResult(null); setState('idle'); }}>
            <Text style={styles.retryText}>Ce n'est pas bon ? Réessayer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Scanner un ticket</Text>
        <Text style={styles.subtitle}>
          Photographiez votre ticket de caisse pour gagner des points.
          1 € d'achat = 1 point (plus avec un abonnement).
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
  mainOptionTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: colors.blanc,
  },
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
  secondaryOptionTitle: {
    fontFamily: 'Nunito_700Bold',
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
  processingTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: colors.gris,
  },
  processingSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },

  // Result
  resultTitle: {
    fontFamily: 'Nunito_900Black',
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
  resultLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.grisMoyen },
  resultValue: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.gris },
  confirmBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: colors.blanc,
  },
  retryText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },
});
