import { UserLocation } from '@couch-heroes/shared';

/**
 * Real GPS/Geolocation Service using browser API
 */
export class GeolocationService {
    private watchId: number | null = null;
    private lastLocation: UserLocation | null = null;

    /**
     * Start watching user's location
     */
    startWatching(
        onLocationUpdate: (location: UserLocation) => void,
        onError?: (error: GeolocationPositionError | Error) => void
    ): void {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            onError?.(new Error('Geolocation not supported'));
            return;
        }

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location: UserLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: position.timestamp,
                    speed: position.coords.speed || 0, // m/s
                };

                this.lastLocation = location;
                onLocationUpdate(location);
            },
            (error) => {
                console.error('Geolocation error:', error);
                onError?.(error);
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
                    };
                    resolve(location);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
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
