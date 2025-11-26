import { create } from 'zustand';
import { Quest, UserLocation, QuestProgress } from '@couch-heroes/shared';
import { haversineDistance, isWithinRadius } from '@couch-heroes/shared';

interface QuestState {
    // Location tracking
    currentLocation: UserLocation | null;
    locationHistory: UserLocation[];

    // Quest management
    activeQuests: Quest[];
    completedQuests: Quest[];
    questProgress: Map<string, QuestProgress>;

    // Service mode
    useMockGPS: boolean;
    quickPlaceEnabled: boolean;

    // Actions
    updateLocation: (location: UserLocation) => void;
    addQuest: (quest: Quest) => void;
    updateQuestProgress: (questId: string) => void;
    completeQuest: (questId: string) => void;
    claimReward: (questId: string) => Promise<void>;
    toggleGPSMode: () => void;
    toggleQuickPlace: () => void;
    clearQuests: () => void;

    // Selectors
    getNearbyQuests: () => Quest[];
}

export const useQuestStore = create<QuestState>((set, get) => ({
    // Initial state
    currentLocation: null,
    locationHistory: [],
    activeQuests: [],
    completedQuests: [],
    questProgress: new Map(),
    useMockGPS: true, // Default to mock for testing
    quickPlaceEnabled: false,

    // Update user's location
    updateLocation: (location: UserLocation) => {
        set((state) => {
            const newHistory = [...state.locationHistory, location];
            // Keep only last 100 locations to prevent memory issues
            if (newHistory.length > 100) {
                newHistory.shift();
            }

            return {
                currentLocation: location,
                locationHistory: newHistory,
            };
        });

        // Auto-update quest progress when location changes
        const { activeQuests } = get();
        activeQuests.forEach((quest) => {
            get().updateQuestProgress(quest.id);
        });
    },

    // Add a new quest
    addQuest: (quest: Quest) => {
        set((state) => {
            const progress: QuestProgress = {
                questId: quest.id,
                userId: 'local-user', // TODO: Replace with actual user ID
                currentDistanceMeters: 0,
                isCompleted: false,
                rewardsClaimed: false,
            };

            const newProgressMap = new Map(state.questProgress);
            newProgressMap.set(quest.id, progress);

            return {
                activeQuests: [...state.activeQuests, quest],
                questProgress: newProgressMap,
            };
        });
    },

    // Update quest progress based on current location
    updateQuestProgress: (questId: string) => {
        const { activeQuests, currentLocation, locationHistory, questProgress } = get();
        const quest = activeQuests.find((q) => q.id === questId);

        if (!quest || !currentLocation) return;

        const progress = questProgress.get(questId);
        if (!progress || progress.isCompleted) return;

        if (quest.type === 'MOVEMENT') {
            // Calculate distance traveled
            if (locationHistory.length >= 2) {
                const prevLocation = locationHistory[locationHistory.length - 2];
                const distanceDelta = haversineDistance(
                    prevLocation.lat,
                    prevLocation.lng,
                    currentLocation.lat,
                    currentLocation.lng
                );

                const newDistance = (progress.currentDistanceMeters || 0) + distanceDelta;

                // Update progress
                const updatedProgress: QuestProgress = {
                    ...progress,
                    currentDistanceMeters: newDistance,
                };

                // Check if quest is complete
                if (quest.targetDistanceMeters && newDistance >= quest.targetDistanceMeters) {
                    get().completeQuest(questId);
                    return;
                }

                set((state) => {
                    const newProgressMap = new Map(state.questProgress);
                    newProgressMap.set(questId, updatedProgress);
                    return { questProgress: newProgressMap };
                });
            }
        } else if (quest.type === 'CHECKIN') {
            // Check proximity to target location
            if (quest.targetCoordinates) {
                const isNearby = isWithinRadius(
                    currentLocation.lat,
                    currentLocation.lng,
                    quest.targetCoordinates.lat,
                    quest.targetCoordinates.lng,
                    quest.radiusMeters || 50
                );

                if (isNearby) {
                    get().completeQuest(questId);
                }
            }
        }
    },

    // Complete a quest
    completeQuest: (questId: string) => {
        set((state) => {
            const quest = state.activeQuests.find((q) => q.id === questId);
            if (!quest) return state;

            const progress = state.questProgress.get(questId);
            if (!progress) return state;

            const updatedProgress: QuestProgress = {
                ...progress,
                isCompleted: true,
                completedAt: new Date(),
            };

            const newProgressMap = new Map(state.questProgress);
            newProgressMap.set(questId, updatedProgress);

            return {
                activeQuests: state.activeQuests.filter((q) => q.id !== questId),
                completedQuests: [...state.completedQuests, quest],
                questProgress: newProgressMap,
            };
        });

        // Show completion notification
        console.log(`Quest completed: ${questId}`);
    },

    // Optimistic reward claiming with rollback on failure
    claimReward: async (questId: string) => {
        const { questProgress } = get();
        const progress = questProgress.get(questId);

        if (!progress || !progress.isCompleted || progress.rewardsClaimed) {
            return;
        }

        // Save previous state for rollback
        const previousProgress = { ...progress };

        // OPTIMISTIC UPDATE: Mark as claimed immediately
        set((state) => {
            const newProgress: QuestProgress = {
                ...progress,
                rewardsClaimed: true,
            };
            const newProgressMap = new Map(state.questProgress);
            newProgressMap.set(questId, newProgress);
            return { questProgress: newProgressMap };
        });

        console.log(`[Optimistic] Claiming rewards for quest ${questId}...`);

        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 500));
            console.log(`[Success] Rewards claimed for quest ${questId}`);
        } catch (error) {
            console.error('[Error] Failed to claim rewards:', error);

            // ROLLBACK: Revert optimistic update
            set((state) => {
                const newProgressMap = new Map(state.questProgress);
                newProgressMap.set(questId, previousProgress);
                return { questProgress: newProgressMap };
            });

            alert('Failed to claim rewards. Please try again.');
        }
    },

    // Toggle between real and mock GPS
    toggleGPSMode: () => {
        set((state) => ({
            useMockGPS: !state.useMockGPS,
        }));
    },

    // Toggle Quick Place mode
    toggleQuickPlace: () => {
        set((state) => ({
            quickPlaceEnabled: !state.quickPlaceEnabled,
        }));
    },

    // Clear all quests (Debug)
    clearQuests: () => {
        set({ activeQuests: [], completedQuests: [], questProgress: new Map() });
    },

    // FOG OF WAR: Get quests within 2km of current location
    getNearbyQuests: () => {
        const { activeQuests, currentLocation } = get();

        if (!currentLocation) {
            return activeQuests; // Show all if no location
        }

        const FOG_OF_WAR_RADIUS = 2000; // 2km in meters

        return activeQuests.filter((quest) => {
            // Movement quests have no specific location, always show
            if (quest.type === 'MOVEMENT') {
                return true;
            }

            // Check-in quests: filter by distance
            if (quest.type === 'CHECKIN' && quest.targetCoordinates) {
                const distance = haversineDistance(
                    currentLocation.lat,
                    currentLocation.lng,
                    quest.targetCoordinates.lat,
                    quest.targetCoordinates.lng
                );
                return distance <= FOG_OF_WAR_RADIUS;
            }

            return true; // Default: show quest
        });
    },
}));
