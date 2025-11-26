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
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[WakeLock] Screen wake lock activated');

                    // Re-acquire wake lock on visibility change
                    const handleVisibilityChange = async () => {
                        if (wakeLock !== null && document.visibilityState === 'visible') {
                            wakeLock = await navigator.wakeLock.request('screen');
                            console.log('[WakeLock] Screen wake lock re-activated');
                        }
                    };

                    document.addEventListener('visibilitychange', handleVisibilityChange);

                    return () => {
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                    };
                } else {
                    console.warn('[WakeLock] Wake Lock API not supported');
                }
            } catch (err) {
                console.error('[WakeLock] Failed to activate wake lock:', err);
            }
        };

        requestWakeLock();

        return () => {
            wakeLock?.release().then(() => {
                console.log('[WakeLock] Screen wake lock released');
            });
        };
    }, []);
}
