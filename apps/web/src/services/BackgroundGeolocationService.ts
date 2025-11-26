/**
 * Background Geolocation Service
 * 
 * Handles background location tracking using @capacitor-community/background-geolocation
 * Stores locations in batches and syncs when app wakes up
 * 
 * Installation Required:
 * npm install @capacitor-community/background-geolocation
 */

import { UserLocation } from '@couch-heroes/shared';

// Type definitions for the plugin (install @capacitor-community/background-geolocation to get real types)
interface BackgroundGeolocationPlugin {
    configure: (config: Record<string, unknown>) => Promise<void>;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getCurrentLocation: (options: Record<string, unknown>) => Promise<BackgroundLocation>;
    on: (event: string, callback: (location: BackgroundLocation) => void) => void;
}

interface BackgroundLocation {
    latitude: number;
    longitude: number;
    speed: number;
    time: number;
    accuracy: number;
    altitude: number;
}

interface WindowWithBGGeo {
    BackgroundGeolocation?: BackgroundGeolocationPlugin;
    Capacitor?: unknown;
}

class BackgroundGeolocationService {
    private isTracking: boolean = false;
    private locationBuffer: UserLocation[] = [];
    private onLocationUpdate?: (location: UserLocation) => void;

    /**
     * Check if background geolocation is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            // Check if running in Capacitor environment
            if (typeof window === 'undefined' || !(window as unknown as { Capacitor: unknown }).Capacitor) {
                console.log('[BGGeo] Not available - not running in Capacitor');
                return false;
            }

            // Try to import the plugin
            const BackgroundGeolocation = (window as unknown as WindowWithBGGeo).BackgroundGeolocation;
            return !!BackgroundGeolocation;
        } catch (error) {
            console.error('[BGGeo] Plugin not available:', error);
            return false;
        }
    }

    /**
     * Start background tracking
     */
    async startTracking(onUpdate: (location: UserLocation) => void): Promise<void> {
        const available = await this.isAvailable();
        if (!available) {
            console.warn('[BGGeo] Background geolocation not available');
            return;
        }

        if (this.isTracking) {
            console.log('[BGGeo] Already tracking');
            return;
        }

        this.onLocationUpdate = onUpdate;

        try {
            const BackgroundGeolocation = (window as unknown as WindowWithBGGeo).BackgroundGeolocation as BackgroundGeolocationPlugin;

            // Configure the plugin
            await BackgroundGeolocation.configure({
                locationProvider: 0, // RAW_PROVIDER
                desiredAccuracy: 10, // HIGH_ACCURACY
                stationaryRadius: 20,
                distanceFilter: 10, // Minimum 10m movement
                notificationTitle: 'Couch Heroes Quest Tracking',
                notificationText: 'Tracking your adventure...',
                notificationIconColor: '#FFD700',
                debug: false,
                interval: 10000, // 10 seconds
                fastestInterval: 5000,
                activitiesInterval: 10000,
                stopOnTerminate: false,
                startOnBoot: true,
            });

            // Listen for location updates
            BackgroundGeolocation.on('location', (location: BackgroundLocation) => {
                this.handleLocationUpdate(location);
            });

            // Start tracking
            await BackgroundGeolocation.start();
            this.isTracking = true;
            console.log('[BGGeo] Background tracking started');
        } catch (error) {
            console.error('[BGGeo] Failed to start tracking:', error);
            throw error;
        }
    }

    /**
     * Stop background tracking
     */
    async stopTracking(): Promise<void> {
        if (!this.isTracking) return;

        try {
            const BackgroundGeolocation = (window as unknown as WindowWithBGGeo).BackgroundGeolocation;
            if (BackgroundGeolocation) {
                await BackgroundGeolocation.stop();
            }
            this.isTracking = false;
            console.log('[BGGeo] Background tracking stopped');

            // Flush any buffered locations
            await this.flushBuffer();
        } catch (error) {
            console.error('[BGGeo] Failed to stop tracking:', error);
        }
    }

    /**
     * Handle incoming location update
     */
    private handleLocationUpdate(bgLocation: BackgroundLocation): void {
        const location: UserLocation = {
            lat: bgLocation.latitude,
            lng: bgLocation.longitude,
            speed: bgLocation.speed || 0,
            timestamp: bgLocation.time,
        };

        // Add to buffer
        this.locationBuffer.push(location);
        console.log(`[BGGeo] Buffered location (${this.locationBuffer.length} total)`);

        // Notify callback
        if (this.onLocationUpdate) {
            this.onLocationUpdate(location);
        }

        // Flush buffer when it reaches 10 locations
        if (this.locationBuffer.length >= 10) {
            this.flushBuffer();
        }
    }

    /**
     * Flush buffered locations
     */
    private async flushBuffer(): Promise<void> {
        if (this.locationBuffer.length === 0) return;

        console.log(`[BGGeo] Flushing ${this.locationBuffer.length} buffered locations`);

        // TODO: Send batch to backend
        // await apiService.sendLocationBatch(this.locationBuffer);

        // For now, just clear the buffer
        this.locationBuffer = [];
    }

    /**
     * Get current tracking status
     */
    getStatus(): { isTracking: boolean; bufferedCount: number } {
        return {
            isTracking: this.isTracking,
            bufferedCount: this.locationBuffer.length,
        };
    }
}

export const backgroundGeolocationService = new BackgroundGeolocationService();
