'use client';

import { useEffect } from 'react';

/**
 * Wake Lock Hook
 * Prevents the screen from sleeping while the user is tracking quests
 */
export function useWakeLock() {
    useEffect(() => {
        let wakeLock: WakeLockSentinel | null = null;

        const requestWakeLock = async () => {
            // Don't request if not visible to avoid NotAllowedError
            if (document.visibilityState !== 'visible') {
                return;
            }

            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[WakeLock] Screen wake lock activated');
                } else {
                    console.warn('[WakeLock] Wake Lock API not supported');
                }
            } catch (err) {
                console.error('[WakeLock] Failed to activate wake lock:', err);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        requestWakeLock();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock) {
                wakeLock.release().then(() => {
                    console.log('[WakeLock] Screen wake lock released');
                }).catch((err) => {
                    console.error('[WakeLock] Failed to release wake lock:', err);
                });
            }
        };
    }, []);
}
