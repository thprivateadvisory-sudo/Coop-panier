'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// VAPID public key — intentionally public (embedded in browser JS by design)
const VAPID_PUBLIC_KEY = 'BKEroJ7qdGYYlWzk65vym1X09F4OWS9eW173V-McNPN8QmfI8s6Am8bLLUnuxhOtLJ0ZAtyxhA-bE6jTJkSLNq8';

async function subscribeToPush(registration: ServiceWorkerRegistration, token: string) {
  if (!VAPID_PUBLIC_KEY) return;
  try {
    const existing = await registration.pushManager.getSubscription();
    // Browsers accept the VAPID public key as a base64url string directly
    const sub = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
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
