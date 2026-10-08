import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/utils/theme';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types';

import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { RoleSelectScreen } from '@/screens/onboarding/RoleSelectScreen';
import { AuthScreen } from '@/screens/onboarding/AuthScreen';
import { ContributorHomeScreen } from '@/screens/contributor/HomeScreen';
import { ScanReceiptScreen } from '@/screens/contributor/ScanReceiptScreen';
import { SubscriptionsScreen } from '@/screens/contributor/SubscriptionsScreen';
import { BeneficiaryCardScreen } from '@/screens/beneficiary/CardScreen';
import { ProfileScreen } from '@/screens/contributor/ProfileScreen';
import { AssociationHomeScreen } from '@/screens/association/AssociationHomeScreen';
import { ScanBeneficiaryScreen } from '@/screens/association/ScanBeneficiaryScreen';
import { BeneficiaryListScreen } from '@/screens/association/BeneficiaryListScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ContributorTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.vert,
        tabBarInactiveTintColor: colors.grisClair,
        tabBarStyle: {
          borderTopColor: colors.bordure,
          paddingBottom: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={ContributorHomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="ScanReceipt"
        component={ScanReceiptScreen}
        options={{
          tabBarLabel: 'Scanner',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📸</Text>,
        }}
      />
      <Tab.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{
          tabBarLabel: 'Abonnement',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚡</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function BeneficiaryTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.vert,
        tabBarInactiveTintColor: colors.grisClair,
      }}
    >
      <Tab.Screen
        name="Card"
        component={BeneficiaryCardScreen}
        options={{
          tabBarLabel: 'Ma carte',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🧺</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

const AssociationStack = createNativeStackNavigator();

function AssociationApp() {
  return (
    <AssociationStack.Navigator screenOptions={{ headerShown: false }}>
      <AssociationStack.Screen name="AssociationHome" component={AssociationHomeScreen} />
      <AssociationStack.Screen name="ScanBeneficiary" component={ScanBeneficiaryScreen} />
      <AssociationStack.Screen name="BeneficiaryList" component={BeneficiaryListScreen} />
    </AssociationStack.Navigator>
  );
}

const OnboardingScreens = () => (
  <>
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
    <Stack.Screen name="AuthStack" component={AuthScreen as React.ComponentType<any>} />
  </>
);

// Charge le profil de l'utilisateur connecté. Si le profil n'existe pas encore
// (première connexion après confirmation de l'email), il est créé à partir des
// informations saisies à l'inscription (user_metadata).
async function loadOrCreateProfile(session: Session): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  // Erreur réseau / serveur : ne pas déconnecter l'utilisateur
  if (error) throw error;
  if (data) return data as Profile;

  const meta = session.user.user_metadata ?? {};
  if (!meta.role) return null;

  const { error: rpcError } = await supabase.rpc('create_user_profile', {
    p_user_id: session.user.id,
    p_email: session.user.email ?? '',
    p_full_name: meta.full_name ?? '',
    p_role: meta.role,
    p_referral_code: meta.referral_code || null,
  });
  if (rpcError) throw rpcError;

  const { data: created } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  return (created as Profile) ?? null;
}

export function Navigation() {
  const { session, profile, setSession, setProfile, loading } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Ne jamais attendre un appel Supabase directement dans ce callback :
        // cela bloque le client (deadlock). On diffère le travail.
        setTimeout(async () => {
          if (!session) {
            setProfile(null);
            setSession(null);
            return;
          }
          try {
            const p = await loadOrCreateProfile(session);
            if (!p) {
              // Compte sans profil exploitable — déconnecter
              await supabase.auth.signOut();
              return;
            }
            setProfile(p);
            setSession(session);
          } catch {
            // Réseau indisponible : on garde la session, le profil sera rechargé plus tard
            setSession(session);
          }
        }, 0);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.blanc }} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <OnboardingScreens />
        ) : profile?.role === 'contributor' ? (
          <Stack.Screen name="ContributorApp" component={ContributorTabs} />
        ) : profile?.role === 'beneficiary' ? (
          <Stack.Screen name="BeneficiaryApp" component={BeneficiaryTabs} />
        ) : profile?.role === 'association' ? (
          <Stack.Screen name="AssociationApp" component={AssociationApp} />
        ) : (
          // session présente mais profil pas encore chargé → onboarding complet accessible
          <OnboardingScreens />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
