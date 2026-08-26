'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(registration: ServiceWorkerRegistration, token: string) {
  if (!VAPID_PUBLIC_KEY) return;
  try {
    const existing = await registration.pushManager.getSubscription();
    const sub = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch {
    // Permission denied or push not supported — silent
  }
}

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      if (!VAPID_PUBLIC_KEY) return;
      if (Notification.permission === 'denied') return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (Notification.permission === 'granted') {
        subscribeToPush(registration, session.access_token);
      } else {
        // Request permission only after the user has logged in
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            subscribeToPush(registration, session.access_token);
          }
        });
      }
    }).catch(() => {});
  }, []);

  return null;
}
