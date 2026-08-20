'use client';
import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { icon: '🏠', label: 'Accueil',    href: '/dashboard/contributor' },
  { icon: '📸', label: 'Scanner',    href: '/dashboard/contributor/scan' },
  { icon: '📋', label: 'Historique', href: '/dashboard/contributor/history' },
  { icon: '⚡', label: 'Forfaits',   href: '/dashboard/contributor/subscriptions' },
  { icon: '👤', label: 'Profil',     href: '/dashboard/contributor/profile' },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={`flex-1 flex flex-col items-center pt-3 pb-2 gap-0.5 transition-all active:scale-95 ${
              active ? 'text-[#2D5016]' : 'text-gray-400'
            }`}
          >
            <span className={`text-2xl leading-none transition-transform duration-150 ${active ? 'scale-110' : 'scale-100'}`}>
              {tab.icon}
            </span>
            <span className={`text-xs ${active ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
            <div className={`h-1 w-5 rounded-full transition-all duration-200 ${active ? 'bg-[#2D5016]' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </nav>
  );
}
