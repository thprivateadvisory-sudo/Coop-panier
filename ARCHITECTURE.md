# Coop'Panier — Architecture v1

## Stack technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Mobile | React Native + Expo SDK 53 | iOS + Android |
| Navigation | React Navigation v7 | Stack + Tabs |
| État global | Zustand | Auth, profil |
| Backend | Supabase | BDD, Auth, Realtime, Storage |
| OCR | Google Cloud Vision API | Lecture des tickets |
| Paiements | Stripe | Abonnements + achats de points |
| Edge Functions | Supabase Deno | process-receipt, create-checkout-session |

---

## Structure du projet

```
Coop-panier/
├── index.html                    ← Landing page GitHub Pages (existant)
├── ARCHITECTURE.md               ← Ce fichier
│
├── mobile/                       ← Application React Native (Expo)
│   ├── App.tsx
│   ├── app.json
│   ├── package.json
│   └── src/
│       ├── navigation/           ← NavigationContainer, stacks, tabs
│       ├── screens/
│       │   ├── onboarding/       ← Onboarding (3 slides) + choix de rôle
│       │   ├── contributor/      ← Accueil, scanner ticket, abonnements
│       │   ├── beneficiary/      ← Carte QR Code bénéficiaire
│       │   └── association/      ← Back-office validation (à venir)
│       ├── hooks/                ← Realtime hooks (useImpactStats, useContributorProfile…)
│       ├── services/             ← Client Supabase
│       ├── store/                ← Zustand (auth)
│       ├── types/                ← TypeScript interfaces
│       └── utils/                ← Thème (couleurs, spacing)
│
└── supabase/
    ├── migrations/
    │   ├── 001_initial_schema.sql   ← Toutes les tables + RLS + triggers
    │   └── 002_credit_points_function.sql
    └── functions/
        └── process-receipt/         ← Edge Function OCR
```

---

## Schéma de base de données

```
profiles (auth.users)
├── contributor_profiles    ← points, abonnement, tickets_scanned
├── beneficiary_profiles    ← qr_code, statut, paniers_reçus
└── association_profiles    ← nom, SIRET, validé

pickup_points               ← points de retrait (liés aux associations)
receipts                    ← tickets scannés (image, montant, points, statut OCR)
baskets                     ← paniers (funding → funded → assigned → distributed)
point_transactions          ← journal de tous les mouvements de points
impact_stats                ← 1 seule ligne, compteurs globaux temps réel
waitlist                    ← liste d'attente landing page
```

---

## Flux de données temps réel (Supabase Realtime)

```
Scan ticket
    → Edge Function process-receipt
    → receipts (INSERT validated)
    → credit_points() [RPC atomique]
    → contributor_profiles UPDATE   ──► WebSocket ──► useContributorProfile() hook
    → point_transactions INSERT
    → trigger update_impact_on_receipt_validate()
    → impact_stats UPDATE           ──► WebSocket ──► useImpactStats() hook
                                                    ──► Landing page (à brancher)
```

---

## Calcul des points

| Tier | Multiplicateur | Points par 100€ |
|------|---------------|-----------------|
| Gratuit | ×1 | 1 000 pts |
| Essentiel (4,99€/mois) | ×2 | 2 000 pts |
| Engagement (9,99€/mois) | ×4 | 4 000 pts |

**500 points = 1 panier alimentaire à 25€**

---

## Écrans implémentés (v1)

1. **OnboardingScreen** — 3 slides illustrés avec pagination
2. **RoleSelectScreen** — Choix contributeur / bénéficiaire / association
3. **ContributorHomeScreen** — Points en temps réel, barre de progression, stats d'impact collectif
4. **ScanReceiptScreen** — Caméra + galerie → OCR → validation points
5. **BeneficiaryCardScreen** — QR Code dynamique + point de retrait + statut temps réel
6. **SubscriptionsScreen** — Plans Essentiel et Engagement avec Stripe Checkout

---

## Démarrage rapide

### Prérequis
- Node.js 20+, npm ou yarn
- Expo CLI : `npm install -g expo-cli`
- Compte Supabase (gratuit)

### Installation
```bash
cd mobile
npm install
```

### Configuration
1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter `supabase/migrations/001_initial_schema.sql` dans l'éditeur SQL
3. Exécuter `supabase/migrations/002_credit_points_function.sql`
4. Remplir les valeurs dans `app.json` → `extra` :
   - `supabaseUrl`
   - `supabaseAnonKey`
   - `stripePublishableKey`

### Lancement
```bash
cd mobile
npm start          # → Expo Go sur votre téléphone
npm run ios        # → Simulateur iOS
npm run android    # → Émulateur Android
```

### Déploiement Edge Function OCR
```bash
supabase functions deploy process-receipt
supabase secrets set GOOGLE_VISION_API_KEY=votre_clé
```

---

## Prochaines étapes (v2)

- [ ] Écran d'authentification (email/password + magic link)
- [ ] Écran profil utilisateur
- [ ] Back-office association (validation QR codes)
- [ ] Notifications push (Expo Notifications)
- [ ] Carte des points de retrait (expo-maps)
- [ ] Parrainage (code unique + 50 pts bonus)
- [ ] Historique des transactions
- [ ] Intégration Stripe Checkout dans l'app (WebView sécurisée)
