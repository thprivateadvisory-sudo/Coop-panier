import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Coop'Panier — Solidarité alimentaire",
  description: "Scannez vos tickets de caisse, financez des paniers solidaires pour les familles dans le besoin.",
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-[#F8F7F4]">{children}</body>
    </html>
  );
}
