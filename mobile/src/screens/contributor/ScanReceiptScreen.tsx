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
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';

// Même API sécurisée que l'application web : lecture du ticket (scan-receipt)
// puis crédit des points côté serveur (submit-scan).
const API_URL = 'https://coop-panier.vercel.app/api';

type ScanState = 'idle' | 'camera' | 'processing' | 'result' | 'error' | 'submitting';

type OcrResult = {
  storeName: string | null;
  detectedAmount: number | null;
  purchaseDate: string | null;
  confidence: number | null;
  imageUrl: string | null;
  amountToken: string | null;
};

type Props = { navigation: any };

async function postJson(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('auth');
  const resp = await fetch(`${API_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await resp.json(); } catch {}
  return { ok: resp.ok, status: resp.status, data: json, userId: data.session?.user.id };
}

export function ScanReceiptScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const cameraRef = useRef<CameraView>(null);

  async function handleCameraCapture() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les réglages.");
        return;
      }
    }
    setState('camera');
  }

  async function takePicture() {
    try {
      // Qualité réduite : l'image doit rester sous la limite de taille du serveur
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.35, base64: true });
      if (photo?.base64) {
        await processImage(`data:image/jpeg;base64,${photo.base64}`);
      } else {
        Alert.alert('Erreur', "La photo n'a pas pu être prise. Réessayez.");
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
      setState('idle');
    }
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setState('error');
  }

  async function processImage(base64: string) {
    setState('processing');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const { ok, status, data } = await postJson('scan-receipt', {
        imageBase64: base64,
        contributorId: sess.session?.user.id,
      });

      if (status === 413) {
        showError("La photo est trop lourde. Réessayez en vous rapprochant du ticket.");
        return;
      }
      if (!ok) throw new Error(data?.error ?? String(status));

      if (data?.detectedAmount == null || !data?.amountToken) {
        showError(
          "Le montant total n'a pas pu être détecté sur ce ticket.\n\nAssurez-vous que le total est bien visible et réessayez."
        );
        return;
      }

      setResult(data as OcrResult);
      setState('result');
    } catch {
      showError("Le ticket n'a pas pu être analysé.\n\nVérifiez votre connexion internet, puis réessayez :\n· Ticket bien éclairé\n· Total clairement visible\n· Évitez les ombres et reflets");
    }
  }

  async function confirmReceipt() {
    if (!result?.detectedAmount || !result.amountToken) return;
    setState('submitting');
    try {
      const { ok, data } = await postJson('submit-scan', {
        detectedAmount: result.detectedAmount,
        amountToken: result.amountToken,
        imageHash: null,
        imageUrl: result.imageUrl || null,
        storeName: result.storeName ?? null,
        purchaseDate: result.purchaseDate ?? null,
        ocrConfidence: result.confidence ?? null,
      });
      if (!ok) {
        Alert.alert('Ticket refusé', data?.error ?? 'Erreur lors de la validation.');
        setState('result');
        return;
      }
      setResult(null);
      setState('idle');
      Alert.alert(
        '🎉 Bravo !',
        `Vous avez gagné ${data?.earned ?? 0} points !`,
        [{ text: 'Super !', onPress: () => navigation.navigate('Home') }]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible de valider le ticket. Vérifiez votre connexion et réessayez.');
      setState('result');
    }
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
  if (state === 'processing' || state === 'submitting') {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={colors.vert} />
        <Text style={styles.processingTitle}>Analyse en cours…</Text>
        <Text style={styles.processingSub}>
          {state === 'submitting' ? 'Crédit de vos points' : 'Lecture de votre ticket de caisse'}
        </Text>
      </View>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.centeredScroll}>
          <Text style={styles.errorEmoji}>📷</Text>
          <Text style={styles.errorTitle}>Ticket non reconnu</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>

          <TouchableOpacity style={styles.retryBtn} onPress={() => setState('camera')} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setState('idle')}>
            <Text style={styles.cancelLink}>Annuler</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Result (OCR success) ──────────────────────────────────────────────────
  if (state === 'result' && result) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.resultTitle}>Ticket reconnu ✓</Text>

          <View style={styles.resultCard}>
            {!!result.storeName && <ResultRow label="Magasin" value={result.storeName} />}
            <ResultRow label="Total" value={`${(result.detectedAmount ?? 0).toFixed(2)} €`} />
            {!!result.purchaseDate && <ResultRow label="Date" value={result.purchaseDate} />}
            {result.confidence != null && (
              <ResultRow label="Fiabilité OCR" value={`${Math.round(result.confidence * 100)}%`} />
            )}
          </View>

          <View style={styles.antifraudNote}>
            <Text style={styles.antifraudText}>
              Le montant est détecté automatiquement par lecture du ticket. Il ne peut pas être modifié.
            </Text>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={confirmReceipt} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Valider et créditer mes points</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setResult(null); setState('idle'); }}>
            <Text style={styles.retryLink}>Ce n'est pas bon ? Réessayer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Idle ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Scanner un ticket</Text>
        <Text style={styles.subtitle}>
          Photographiez votre ticket de caisse pour gagner des points.{'\n'}
          1 € d'achat = 1 point.
        </Text>

        <TouchableOpacity style={styles.mainOption} onPress={handleCameraCapture} activeOpacity={0.85}>
          <Text style={styles.mainOptionEmoji}>📸</Text>
          <Text style={styles.mainOptionTitle}>Prendre une photo</Text>
          <Text style={styles.mainOptionSub}>Le montant sera détecté automatiquement</Text>
        </TouchableOpacity>

        <View style={styles.disabledOption}>
          <Text style={styles.disabledEmoji}>🖼️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.disabledTitle}>Importer depuis la galerie</Text>
            <Text style={styles.disabledSub}>Disponible dans une prochaine mise à jour</Text>
          </View>
        </View>

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
  centeredScroll: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },

  disabledOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.bordure,
    opacity: 0.5,
  },
  disabledEmoji: { fontSize: 24 },
  disabledTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.gris },
  disabledSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.grisMoyen, marginTop: 2 },

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

  // Error
  errorEmoji: { fontSize: 56, textAlign: 'center' },
  errorTitle: { fontFamily: 'Nunito_900Black', fontSize: 24, color: colors.gris, textAlign: 'center' },
  errorMsg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  retryBtnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.blanc },
  cancelLink: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
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
  antifraudNote: {
    backgroundColor: '#FFF9E6',
    borderRadius: radius.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
  },
  antifraudText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.grisMoyen,
    lineHeight: 18,
  },
  confirmBtn: {
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: colors.blanc },
  retryLink: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.grisMoyen,
    textAlign: 'center',
  },
});
