import { UserLocation, ValidationResult } from './types';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Check if a location is within radius of target coordinates
 */
export function isWithinRadius(
    userLat: number,
    userLng: number,
    targetLat: number,
    targetLng: number,
    radiusMeters: number = 50
): boolean {
    const distance = haversineDistance(userLat, userLng, targetLat, targetLng);
    return distance <= radiusMeters;
}

/**
 * Calculate speed between two location points in m/s
 */
export function calculateSpeed(
    loc1: UserLocation,
    loc2: UserLocation
): number {
    const distance = haversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
    const timeDiffSeconds = (loc2.timestamp - loc1.timestamp) / 1000;

    if (timeDiffSeconds === 0) return 0;
    return distance / timeDiffSeconds;
}

/**
 * Convert m/s to km/h
 */
export function msToKmh(speedMs: number): number {
    return speedMs * 3.6;
}

/**
 * Convert km/h to m/s
 */
export function kmhToMs(speedKmh: number): number {
    return speedKmh / 3.6;
}

/**
 * Validate movement speed (anti-cheat)
 * Max speed: 30 km/h (8.33 m/s)
 */
export function validateSpeed(
    loc1: UserLocation,
    loc2: UserLocation,
    maxSpeedKmh: number = 30
): ValidationResult {
    const speedMs = calculateSpeed(loc1, loc2);
    const speedKmh = msToKmh(speedMs);

    if (speedKmh > maxSpeedKmh) {
        return {
            isValid: false,
            reason: `Speed ${speedKmh.toFixed(2)} km/h exceeds maximum ${maxSpeedKmh} km/h`,
            flaggedForReview: speedKmh > maxSpeedKmh * 2, // Flag if double the limit
        };
    }

    return { isValid: true };
}

/**
 * Detect teleportation (unreasonable distance in short time)
 */
export function detectTeleportation(
    loc1: UserLocation,
    loc2: UserLocation
): ValidationResult {
    const distance = haversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
    const timeDiffSeconds = (loc2.timestamp - loc1.timestamp) / 1000;

    // If time diff is less than 1 second and distance > 100m, likely teleportation
    if (timeDiffSeconds < 1 && distance > 100) {
        return {
            isValid: false,
            reason: `Suspicious movement: ${distance.toFixed(0)}m in ${timeDiffSeconds.toFixed(2)}s`,
            flaggedForReview: true,
        };
    }

    // Also check using speed validation
    return validateSpeed(loc1, loc2);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * Generate a simple unique ID (for client-side use)
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
