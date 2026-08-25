import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/utils/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    emoji: '🛒',
    title: 'Faites vos courses,\nchangez une vie',
    subtitle:
      'Chaque ticket de caisse scanné génère des points qui financent des paniers alimentaires pour les familles dans le besoin.',
    bg: colors.vert,
    textColor: colors.blanc,
  },
  {
    id: '2',
    emoji: '📸',
    title: 'Scannez votre ticket\nen 10 secondes',
    subtitle:
      'Notre technologie OCR extrait automatiquement le montant de vos achats. Plus le montant est élevé, plus vous gagnez de points.',
    bg: colors.blanc,
    textColor: colors.gris,
  },
  {
    id: '3',
    emoji: '🧺',
    title: 'Vos points deviennent\ndes paniers réels',
    subtitle:
      '500 points = 1 panier alimentaire à 25€. Distribué par nos associations partenaires près de chez vous.',
    bg: colors.orange,
    textColor: colors.blanc,
  },
];

type Props = NativeStackScreenProps<any, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function handleNext() {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
      setActiveIndex((i) => i + 1);
    } else {
      navigation.navigate('RoleSelect');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.slide, { backgroundColor: item.bg }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.title, { color: item.textColor }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: item.textColor, opacity: 0.8 }]}>
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.btnText}>
            {activeIndex < slides.length - 1 ? 'Suivant' : 'Commencer'}
          </Text>
        </TouchableOpacity>

        {activeIndex < slides.length - 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('RoleSelect')}>
            <Text style={styles.skip}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.vert },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emoji: { fontSize: 72, marginBottom: spacing.xl },
  title: {
    fontFamily: 'Nunito-Black',
    fontSize: 30,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blanc,
  },
  dots: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.bordure },
  dotActive: { backgroundColor: colors.vert, width: 24 },
  btn: {
    width: '100%',
    backgroundColor: colors.vert,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'Nunito-ExtraBold',
    fontSize: 16,
    color: colors.blanc,
  },
  skip: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.grisMoyen,
  },
});
