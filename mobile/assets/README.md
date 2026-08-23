# Assets requis pour le build

## ⚠️ OBLIGATOIRE avant `eas build`

Placez les fichiers suivants dans ce dossier :

### Icônes (requis par app.json)
| Fichier | Dimensions | Usage |
|---------|-----------|-------|
| `icon.png` | 1024×1024 px | Icône iOS + base Android |
| `adaptive-icon.png` | 1024×1024 px | Icône adaptative Android (fond vert #2D5016) |
| `splash.png` | 1284×2778 px | Splash screen (fond vert #2D5016) |
| `favicon.png` | 196×196 px | Web uniquement |

### Spécifications
- Format : PNG avec transparence (sauf splash)
- Couleur de fond (splash + adaptive) : `#2D5016`
- Pas de texte dans l'icône (règle App Store Connect)
- L'icône ne doit PAS avoir de coins arrondis (iOS les applique automatiquement)

### Outils recommandés
- [Expo Icon Guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [EAS Icon Generator](https://docs.expo.dev/build/building-on-ci/)
