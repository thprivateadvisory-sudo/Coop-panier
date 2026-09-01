import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/utils/theme';

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

export function Navigation() {
  const { session, profile, setSession, setProfile, loading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch(() => setSession(null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setSession(session);
          if (session) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (!data) {
              await supabase.auth.signOut();
            } else {
              setProfile(data);
            }
          } else {
            setProfile(null);
          }
        } catch {
          setSession(null);
        }
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
        {!session || !profile?.role ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
            <Stack.Screen name="AuthStack" component={AuthScreen} />
          </>
        ) : profile.role === 'contributor' ? (
          <Stack.Screen name="ContributorApp" component={ContributorTabs} />
        ) : profile.role === 'beneficiary' ? (
          <Stack.Screen name="BeneficiaryApp" component={BeneficiaryTabs} />
        ) : (
          <Stack.Screen name="AssociationApp" component={AssociationApp} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
