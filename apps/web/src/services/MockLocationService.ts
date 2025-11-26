import { UserLocation } from '@couch-heroes/shared';

type MovementKey = 'w' | 'a' | 's' | 'd' | 'ArrowUp' | 'ArrowLeft' | 'ArrowDown' | 'ArrowRight';

/**
 * Mock GPS service for testing without leaving your desk
 * Uses keyboard controls (WASD/Arrow keys) to simulate movement
 */
export class MockLocationService {
    private currentLocation: UserLocation;
    private updateInterval: NodeJS.Timeout | null = null;
    private pressedKeys = new Set<MovementKey>();
    private speedMps: number = 1.4; // Default walking speed (1.4 m/s ≈ 5 km/h)

    // Movement constants
    private readonly WALKING_SPEED = 1.4; // 5 km/h
    private readonly RUNNING_SPEED = 3.0; // 11 km/h
    private readonly CYCLING_SPEED = 5.5; // 20 km/h

    constructor(initialLat: number = 37.9838, initialLng: number = 23.7275) {
        this.currentLocation = {
            lat: initialLat,
            lng: initialLng,
            timestamp: Date.now(),
            speed: 0,
        };

        this.setupKeyboardListeners();
    }

    private setupKeyboardListeners(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.isMovementKey(key)) {
                this.pressedKeys.add(key as MovementKey);
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.isMovementKey(key)) {
                this.pressedKeys.delete(key as MovementKey);
                e.preventDefault();
            }
        });
    }

    private isMovementKey(key: string): boolean {
        return ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key);
    }

    /**
     * Start watching/simulating location updates
     */
    startWatching(
        onLocationUpdate: (location: UserLocation) => void,
        onError?: (error: Error) => void
    ): void {
        // Update position every 100ms
        this.updateInterval = setInterval(() => {
            this.updatePosition();
            onLocationUpdate(this.currentLocation);
        }, 100);
    }

    /**
     * Stop watching
     */
    stopWatching(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Update position based on pressed keys
     */
    private updatePosition(): void {
        if (this.pressedKeys.size === 0) {
            this.currentLocation.speed = 0;
            return;
        }

        // Calculate movement direction
        let deltaLat = 0;
        let deltaLng = 0;

        // North/South
        if (this.pressedKeys.has('w') || this.pressedKeys.has('ArrowUp' as MovementKey)) {
            deltaLat += 1;
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('ArrowDown' as MovementKey)) {
            deltaLat -= 1;
        }

        // East/West
        if (this.pressedKeys.has('d') || this.pressedKeys.has('ArrowRight' as MovementKey)) {
            deltaLng += 1;
        }
        if (this.pressedKeys.has('a') || this.pressedKeys.has('ArrowLeft' as MovementKey)) {
            deltaLng -= 1;
        }

        // Normalize diagonal movement
        if (deltaLat !== 0 && deltaLng !== 0) {
            const diagonal = Math.sqrt(2);
            deltaLat /= diagonal;
            deltaLng /= diagonal;
        }

        // Convert speed (m/s) to degrees (approximate)
        // At equator: 1 degree ≈ 111,320 meters
        // This is a rough approximation
        const metersPerDegree = 111320;
        const distanceMeters = this.speedMps * 0.1; // 100ms interval = 0.1s
        const deltaLatDegrees = (deltaLat * distanceMeters) / metersPerDegree;
        const deltaLngDegrees = (deltaLng * distanceMeters) / (metersPerDegree * Math.cos((this.currentLocation.lat * Math.PI) / 180));

        // Update location
        const newLat = this.currentLocation.lat + deltaLatDegrees;
        const newLng = this.currentLocation.lng + deltaLngDegrees;
        const newTimestamp = Date.now();

        this.currentLocation = {
            lat: newLat,
            lng: newLng,
            timestamp: newTimestamp,
            speed: this.pressedKeys.size > 0 ? this.speedMps : 0,
        };
    }

    /**
     * Get current mock location
     */
    async getCurrentLocation(): Promise<UserLocation> {
        return Promise.resolve({ ...this.currentLocation });
    }

    getLastLocation(): UserLocation {
        return { ...this.currentLocation };
    }

    /**
     * Set movement speed
     */
    setSpeed(speedMps: number): void {
        this.speedMps = speedMps;
    }

    /**
     * Set speed preset
     */
    setSpeedPreset(preset: 'walking' | 'running' | 'cycling'): void {
        switch (preset) {
            case 'walking':
                this.speedMps = this.WALKING_SPEED;
                break;
            case 'running':
                this.speedMps = this.RUNNING_SPEED;
                break;
            case 'cycling':
                this.speedMps = this.CYCLING_SPEED;
                break;
        }
    }

    /**
     * Teleport to a new location
     */
    teleportTo(lat: number, lng: number): void {
        this.currentLocation = {
            lat,
            lng,
            timestamp: Date.now(),
            speed: 0,
        };
    }
}

export const mockLocationService = new MockLocationService();
