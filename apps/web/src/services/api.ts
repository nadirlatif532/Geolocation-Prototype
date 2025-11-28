import { UserLocation } from '@couch-heroes/shared';
import { questSpawner } from './QuestSpawner';

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const OFFLINE_QUEUE_KEY = 'pending_updates';

interface LocationUpdate {
    userId: string;
    lat: number;
    lng: number;
    speed: number;
    timestamp: number;
}

interface QueuedUpdate {
    payload: LocationUpdate;
    timestamp: number;
    retries: number;
}

interface ScanResponse {
    quests: import('@couch-heroes/shared').Quest[];
}

class ApiService {
    private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
    // private isFlushing: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            // Listen for online/offline events
            window.addEventListener('online', () => {
                console.log('[API] Network connection restored');
                this.isOnline = true;
                // this.flushOfflineQueue();
            });

            window.addEventListener('offline', () => {
                console.log('[API] Network connection lost');
                this.isOnline = false;
            });
        }
    }

    /**
     * Send location update to backend
     * If offline, queue in localStorage
     */
    async updateLocation(userId: string, location: UserLocation): Promise<void> {
        const payload: LocationUpdate = {
            userId,
            lat: location.lat,
            lng: location.lng,
            speed: location.speed,
            timestamp: location.timestamp,
        };

        // CLIENT-ONLY MODE:
        // In a real backend scenario, we would send this to the server.
        // For now, we just log it to simulate the "sent" state.
        console.log('[API] (Client-Only) Location update processed:', payload);

        // Optional: We could store this in localStorage if we wanted a local history
    }

    /**
     * Scan for local mystery quests
     */
    async scanQuests(userId: string, lat: number, lng: number, excludeLandmarkIds: string[] = []): Promise<ScanResponse> {
        // CLIENT-ONLY MODE:
        // Instead of fetching from API, we generate locally.
        console.log(`[API] (Client-Only) Scanning for quests for user ${userId} at ${lat}, ${lng}, excluding ${excludeLandmarkIds.length} landmarks`);

        // Simulate network delay for realism
        await new Promise(resolve => setTimeout(resolve, 500));

        const quests = await questSpawner.spawnLocalQuests(lat, lng, excludeLandmarkIds);

        return { quests };
    }

    /**
     * Queue update in localStorage
     */
    private queueUpdate(payload: LocationUpdate): void {
        if (typeof window === 'undefined') return;

        try {
            const queue = this.getOfflineQueue();
            queue.push({
                payload,
                timestamp: Date.now(),
                retries: 0,
            });

            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            console.log(`[API] Queued update (Queue size: ${queue.length})`);
        } catch (error) {
            console.error('[API] Failed to queue update:', error);
        }
    }

    /**
     * Get queued updates from localStorage
     */
    private getOfflineQueue(): QueuedUpdate[] {
        if (typeof window === 'undefined') return [];

        try {
            const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[API] Failed to read offline queue:', error);
            return [];
        }
    }

    /**
     * Get queue status
     */
    getQueueStatus(): { count: number; isOnline: boolean } {
        return {
            count: this.getOfflineQueue().length,
            isOnline: this.isOnline,
        };
    }

    /**
     * Clear offline queue (for testing/debugging)
     */
    clearQueue(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(OFFLINE_QUEUE_KEY);
            console.log('[API] Offline queue cleared');
        }
    }
}

// Export singleton instance
export const apiService = new ApiService();
