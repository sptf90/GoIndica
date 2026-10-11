'use client';
import { useEffect } from 'react';
import { sendEvent } from '@/lib/analytics-client';
export function LandingAnalytics() {
  useEffect(() => {
    void sendEvent('LANDING_VISIT');
    const click = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('a[href="/entrar"]'))
        void sendEvent('CTA_CLICK');
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);
  return null;
}
