/**
 * Quest Type Definitions
 * Follows the exact structure from rules.md
 */

export type QuestType = 'MOVEMENT' | 'CHECKIN' | 'DAILY' | 'MYSTERY';

export interface Quest {
    id: string;
    type: QuestType;
    title: string;
    description: string;
    // For Movement Quests
    targetDistanceMeters?: number;
    currentDistanceMeters?: number;
    // For Check-in Quests
    targetCoordinates?: { lat: number; lng: number };
    radiusMeters?: number; // Default 50m
    // Rewards
    rewards: {
        type: 'EXP' | 'ITEM' | 'CURRENCY';
        value: string | number;
        itemId?: string;
    }[];
}

export interface UserLocation {
    lat: number;
    lng: number;
    timestamp: number;
    speed: number; // m/s
}

/**
 * Reward destination types
 */
export type RewardDestination = 'MAILBOX' | 'MARKETPLACE';

/**
 * Extended reward interface with destination
 */
export interface RewardWithDestination {
    type: 'EXP' | 'ITEM' | 'CURRENCY';
    value: string | number;
    itemId?: string;
    destination: RewardDestination;
}

/**
 * Quest progress tracking
 */
export interface QuestProgress {
    questId: string;
    userId: string;
    currentDistanceMeters?: number;
    isCompleted: boolean;
    completedAt?: Date;
    rewardsClaimed: boolean;
}

/**
 * Anti-cheat validation result
 */
export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    flaggedForReview?: boolean;
}
