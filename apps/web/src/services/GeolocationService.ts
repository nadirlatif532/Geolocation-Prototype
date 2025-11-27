import { UserLocation } from '@couch-heroes/shared';

/**
 * Real GPS/Geolocation Service using browser API
 */
export class GeolocationService {
    /**
     * Parse Geolocation Error to user-friendly string
     */
    private getErrorMessage(error: GeolocationPositionError | Error): string {
        if (error instanceof Error) return error.message;

        switch (error.code) {
            case error.PERMISSION_DENIED:
                return 'Location permission denied. Please enable it in your browser settings.';
            case error.POSITION_UNAVAILABLE:
                return 'Location information is unavailable. Check your GPS signal.';
            case error.TIMEOUT:
                return 'Location request timed out. Please try again.';
            default:
                return 'An unknown error occurred.';
        }
    }

    /**
     * Start watching user's location
     */
    startWatching(
        onLocationUpdate: (location: UserLocation) => void,
        onError?: (error: string) => void
    ): void {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            onError?.('Geolocation is not supported by your browser.');
            return;
        }

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 20000, // Increased timeout for better initial lock
            maximumAge: 0,
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location: UserLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: position.timestamp,
                    speed: position.coords.speed || 0, // m/s
                    heading: position.coords.heading ?? undefined, // degrees, null if stationary
                };

                this.lastLocation = location;
                onLocationUpdate(location);
            },
            (error) => {
                console.error('Geolocation error:', error);
                onError?.(this.getErrorMessage(error));
            },
            options
        );
    }

    /**
     * Stop watching location
     */
    stopWatching(): void {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Get current location (one-time request)
     */
    async getCurrentLocation(): Promise<UserLocation> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location: UserLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        timestamp: position.timestamp,
                        speed: position.coords.speed || 0,
                        heading: position.coords.heading ?? undefined,
                    };
                    resolve(location);
                },
                (error) => {
                    reject(new Error(this.getErrorMessage(error)));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                }
            );
        });
    }

    getLastLocation(): UserLocation | null {
        return this.lastLocation;
    }
}

export const geolocationService = new GeolocationService();
