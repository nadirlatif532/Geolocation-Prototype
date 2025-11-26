import { Quest, UserLocation } from '@couch-heroes/shared';
import { haversineDistance, isWithinRadius } from '@couch-heroes/shared';

/**
 * QuestManager
 * Core logic for tracking and validating quest progress
 */
export class QuestManager {
    /**
     * Calculate progress for a movement quest
     */
    static calculateMovementProgress(
        quest: Quest,
        locationHistory: UserLocation[]
    ): number {
        if (quest.type !== 'MOVEMENT' || !quest.targetDistanceMeters) {
            return 0;
        }

        if (locationHistory.length < 2) {
            return 0;
        }

        // Calculate total distance traveled
        let totalDistance = 0;
        for (let i = 1; i < locationHistory.length; i++) {
            const prev = locationHistory[i - 1];
            const curr = locationHistory[i];

            const distance = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
            totalDistance += distance;
        }

        return totalDistance;
    }

    /**
     * Check if user is within check-in radius
     */
    static isCheckInComplete(quest: Quest, currentLocation: UserLocation): boolean {
        if (quest.type !== 'CHECKIN' || !quest.targetCoordinates) {
            return false;
        }

        return isWithinRadius(
            currentLocation.lat,
            currentLocation.lng,
            quest.targetCoordinates.lat,
            quest.targetCoordinates.lng,
            quest.radiusMeters || 50
        );
    }

    /**
     * Check if a quest is complete
     */
    static isQuestComplete(
        quest: Quest,
        currentLocation: UserLocation | null,
        locationHistory: UserLocation[]
    ): boolean {
        if (!currentLocation) return false;

        if (quest.type === 'MOVEMENT') {
            const progress = this.calculateMovementProgress(quest, locationHistory);
            return quest.targetDistanceMeters ? progress >= quest.targetDistanceMeters : false;
        }

        if (quest.type === 'CHECKIN') {
            return this.isCheckInComplete(quest, currentLocation);
        }

        return false;
    }

    /**
     * Get quest progress percentage (0-100)
     */
    static getProgressPercentage(
        quest: Quest,
        currentLocation: UserLocation | null,
        locationHistory: UserLocation[]
    ): number {
        if (quest.type === 'MOVEMENT' && quest.targetDistanceMeters) {
            const progress = this.calculateMovementProgress(quest, locationHistory);
            return Math.min(100, (progress / quest.targetDistanceMeters) * 100);
        }

        if (quest.type === 'CHECKIN' && currentLocation) {
            return this.isCheckInComplete(quest, currentLocation) ? 100 : 0;
        }

        return 0;
    }

    /**
     * Get distance to check-in location
     */
    static getDistanceToCheckIn(
        quest: Quest,
        currentLocation: UserLocation
    ): number | null {
        if (quest.type !== 'CHECKIN' || !quest.targetCoordinates) {
            return null;
        }

        return haversineDistance(
            currentLocation.lat,
            currentLocation.lng,
            quest.targetCoordinates.lat,
            quest.targetCoordinates.lng
        );
    }
}
