import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coop'Panier",
    short_name: 'CoopPanier',
    description: "Scannez vos tickets de caisse, financez des paniers solidaires pour les familles dans le besoin.",
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F8F7F4',
    theme_color: '#2D5016',
    categories: ['food', 'social', 'lifestyle'],
    lang: 'fr',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/contributor.png',
        sizes: '390x844',
        type: 'image/png',
        // @ts-expect-error — form_factor is valid but not yet in TS types
        form_factor: 'narrow',
        label: 'Tableau de bord contributeur',
      },
    ],
    shortcuts: [
      {
        name: 'Scanner un ticket',
        short_name: 'Scanner',
        url: '/dashboard/contributor/scan',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
