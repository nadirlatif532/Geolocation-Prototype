import { UserLocation } from '@couch-heroes/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
    private isFlushing: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            // Listen for online/offline events
            window.addEventListener('online', () => {
                console.log('[API] Network connection restored');
                this.isOnline = true;
                this.flushOfflineQueue();
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

        // Check if online
        if (this.isOnline && navigator.onLine) {
            try {
                await this.sendLocationUpdate(payload);
                console.log('[API] Location update sent successfully');
            } catch (error) {
                console.error('[API] Failed to send location update:', error);
                // If network error, queue it
                this.queueUpdate(payload);
            }
        } else {
            console.log('[API] Offline - queuing location update');
            this.queueUpdate(payload);
        }
    }

    /**
     * Scan for local mystery quests
     */
    async scanQuests(userId: string, lat: number, lng: number): Promise<ScanResponse> {
        if (!this.isOnline) {
            console.warn('[API] Cannot scan for quests while offline');
            return { quests: [] };
        }

        try {
            const response = await fetch(`${API_BASE_URL}/quests/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, lat, lng }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[API] Failed to scan for quests:', error);
            throw error;
        }
    }

    /**
     * Send location update to backend
     */
    private async sendLocationUpdate(payload: LocationUpdate): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/location/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
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
     * Flush queued updates when back online
     */
    async flushOfflineQueue(): Promise<void> {
        if (this.isFlushing || !this.isOnline) return;

        this.isFlushing = true;
        const queue = this.getOfflineQueue();

        if (queue.length === 0) {
            this.isFlushing = false;
            return;
        }

        console.log(`[API] Flushing ${queue.length} queued updates...`);

        const failedUpdates: QueuedUpdate[] = [];

        for (const queuedUpdate of queue) {
            try {
                await this.sendLocationUpdate(queuedUpdate.payload);
                console.log(`[API] Successfully sent queued update from ${new Date(queuedUpdate.timestamp).toISOString()}`);
            } catch (error) {
                console.error('[API] Failed to send queued update:', error);

                // Retry up to 3 times
                if (queuedUpdate.retries < 3) {
                    failedUpdates.push({
                        ...queuedUpdate,
                        retries: queuedUpdate.retries + 1,
                    });
                } else {
                    console.warn('[API] Dropping update after 3 retries');
                }
            }

            // Small delay to avoid overwhelming the server
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Update queue with failed items
        if (typeof window !== 'undefined') {
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedUpdates));
            console.log(`[API] Queue flush complete. ${failedUpdates.length} items remaining`);
        }

        this.isFlushing = false;
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
