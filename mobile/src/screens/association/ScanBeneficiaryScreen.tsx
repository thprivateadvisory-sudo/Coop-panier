import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type ScanState = 'scanning' | 'processing' | 'success' | 'error';

type BeneficiaryInfo = {
  name: string;
  baskets_received: number;
  qr_code: string;
  profile_id: string;
};

type Props = { navigation: any };

export function ScanBeneficiaryScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('scanning');
  const [beneficiary, setBeneficiary] = useState<BeneficiaryInfo | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  async function handleBarCodeScanned({ data }: BarcodeScanningResult) {
    if (scanned || state !== 'scanning') return;
    setScanned(true);
    setState('processing');

    try {
      // Décoder le QR code
      const payload = JSON.parse(data);
      const { id: profileId, qr: qrCode } = payload;

      if (!profileId || !qrCode) throw new Error('QR invalide');

      // Vérifier le bénéficiaire dans Supabase
      const { data: beneProfile, error } = await supabase
        .from('beneficiary_profiles')
        .select('profile_id, qr_code, baskets_received, status')
        .eq('profile_id', profileId)
        .eq('qr_code', qrCode)
        .single();

      if (error || !beneProfile) throw new Error('Bénéficiaire introuvable');
      if (beneProfile.status !== 'active') throw new Error('Cette carte n\'est pas active');

      // Récupérer le nom
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', profileId)
        .single();

      setBeneficiary({
        profile_id: profileId,
        qr_code: qrCode,
        name: profileData?.full_name ?? 'Bénéficiaire',
        baskets_received: beneProfile.baskets_received,
      });

      setState('success');
    } catch (err: any) {
      setState('error');
      Alert.alert(
        'QR Code invalide',
        err.message ?? 'Ce code ne correspond à aucun bénéficiaire actif.',
        [{ text: 'Réessayer', onPress: () => { setState('scanning'); setScanned(false); } }]
      );
    }
  }

  async function confirmDistribution() {
    if (!beneficiary || !profile?.id) return;
    setState('processing');

    try {
      // Trouver un panier assigné à ce bénéficiaire
      const { data: basket } = await supabase
        .from('baskets')
        .select('id')
        .eq('beneficiary_profile_id', beneficiary.profile_id)
        .eq('status', 'assigned')
        .limit(1)
        .single();

      if (!basket) {
        // Aucun panier assigné — on crée une distribution directe
        Alert.alert(
          'Aucun panier assigné',
          'Ce bénéficiaire n\'a pas de panier assigné actuellement. Contactez l\'administrateur.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Marquer le panier comme distribué
      await supabase
        .from('baskets')
        .update({ status: 'distributed', distributed_at: new Date().toISOString() })
        .eq('id', basket.id);

      // Incrémenter le compteur du bénéficiaire
      await supabase
        .from('beneficiary_profiles')
        .update({ baskets_received: beneficiary.baskets_received + 1 })
        .eq('profile_id', beneficiary.profile_id);

      Alert.alert(
        '✅ Distribution validée',
        `Le panier de ${beneficiary.name} a été enregistré.`,
        [{ text: 'Parfait', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la distribution. Réessayez.');
      setState('success');
    }
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.permText}>L'accès à la caméra est nécessaire pour scanner les QR codes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (state === 'processing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.vert} />
        <Text style={styles.processingText}>Vérification en cours…</Text>
      </View>
    );
  }

  if (state === 'success' && beneficiary) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.resultContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>✅</Text>
          </View>

          <Text style={styles.resultTitle}>Bénéficiaire vérifié</Text>

          <View style={styles.beneCard}>
            <Text style={styles.beneName}>{beneficiary.name}</Text>
            <Text style={styles.beneStats}>
              {beneficiary.baskets_received} panier{beneficiary.baskets_received > 1 ? 's' : ''} reçu{beneficiary.baskets_received > 1 ? 's' : ''} au total
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={confirmDistribution}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>Confirmer la remise du panier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => { setState('scanning'); setScanned(false); setBeneficiary(null); }}
          >
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>✕  Fermer</Text>
          </TouchableOpacity>

          <View style={styles.frameWrapper}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.frameHint}>Pointez sur le QR Code de la carte bénéficiaire</Text>
          </View>

          <View style={styles.bottomHint}>
            <Text style={styles.bottomHintText}>
              Le code est présenté dans l'appli Coop'Panier du bénéficiaire
            </Text>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fond },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.fond },

  permText: { fontFamily: 'Inter-Regular', fontSize: 15, color: colors.grisMoyen, textAlign: 'center' },
  permBtn: { backgroundColor: colors.vert, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.xl },
  permBtnText: { fontFamily: 'Nunito-ExtraBold', fontSize: 15, color: colors.blanc },
  processingText: { fontFamily: 'Inter-Regular', fontSize: 15, color: colors.grisMoyen, marginTop: spacing.md },

  // Caméra
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.blanc },

  frameWrapper: { alignItems: 'center', gap: spacing.xl },
  frame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.orange,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  frameHint: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.blanc, textAlign: 'center' },

  bottomHint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bottomHintText: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  // Résultat
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.vertPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successEmoji: { fontSize: 40 },
  resultTitle: { fontFamily: 'Nunito-Black', fontSize: 26, color: colors.gris },
  beneCard: {
    width: '100%',
    backgroundColor: colors.blanc,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.vert,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  beneName: { fontFamily: 'Nunito-Black', fontSize: 22, color: colors.gris },
  beneStats: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.grisMoyen },
  confirmBtn: {
    width: '100%',
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { fontFamily: 'Nunito-ExtraBold', fontSize: 16, color: colors.blanc },
  cancelBtn: { paddingVertical: spacing.sm },
  cancelBtnText: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.grisMoyen },
});
