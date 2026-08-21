import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from './_components/PwaRegister';

export const metadata: Metadata = {
  title: "Coop'Panier — Solidarité alimentaire",
  description: "Scannez vos tickets de caisse, financez des paniers solidaires pour les familles dans le besoin.",
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "Coop'Panier",
    startupImage: '/icons/icon-512.png',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#2D5016',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F8F7F4]">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
