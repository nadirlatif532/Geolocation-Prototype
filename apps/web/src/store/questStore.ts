import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
    lastCompletedQuestId: string | null;

    // Service mode
    useMockGPS: boolean;
    quickPlaceEnabled: boolean;
    mapTheme: 'default' | 'cyber';

    // Actions
    updateLocation: (location: UserLocation) => void;
    addQuest: (quest: Quest) => void;
    updateQuestProgress: (questId: string) => void;
    completeQuest: (questId: string) => void;
    claimReward: (questId: string) => Promise<void>;
    toggleGPSMode: () => void;
    setGPSMode: (useMock: boolean) => void;
    toggleQuickPlace: () => void;
    toggleMapTheme: () => void;
    clearQuests: () => void;
    consumeCompletedQuest: () => void;

    // Selectors
    getNearbyQuests: () => Quest[];
    refreshMilestoneQuest: () => Promise<void>;
    generateMilestoneQuests: () => Promise<void>;
    milestoneRefreshCount: number;
    milestoneRefreshResetTime: number;
    localLandmarkRefreshTime: number;

    // Data Management
    exportSave: () => string;
    importSave: (json: string) => boolean;
    resetData: () => void;
    generateLocalLandmarkQuests: (ignoreIds?: string[]) => Promise<void>;

    // History
    recentQuestHistory: string[];
    addToQuestHistory: (ids: string[]) => void;
}

export const useQuestStore = create<QuestState>()(
    persist(
        (set, get) => ({
            // Initial state
            currentLocation: null,
            locationHistory: [],
            activeQuests: [],
            completedQuests: [],
            questProgress: new Map(),
            lastCompletedQuestId: null,
            useMockGPS: false, // Default to Real GPS
            quickPlaceEnabled: false,
            mapTheme: 'cyber', // Default to Cyber
            localLandmarkRefreshTime: 0,
            recentQuestHistory: [],

            // Add IDs to history (keep last 10)
            addToQuestHistory: (ids: string[]) => {
                set((state) => {
                    // Filter out duplicates from new IDs
                    const uniqueNewIds = ids.filter(id => !state.recentQuestHistory.includes(id));
                    const newHistory = [...state.recentQuestHistory, ...uniqueNewIds];

                    // Keep only last 10
                    if (newHistory.length > 10) {
                        return { recentQuestHistory: newHistory.slice(newHistory.length - 10) };
                    }
                    return { recentQuestHistory: newHistory };
                });
            },

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
                        lastCompletedQuestId: questId,
                    };
                });

                // Show completion notification
                console.log(`Quest completed: ${questId}`);

                // Add to history
                get().addToQuestHistory([questId]);

                // AUTO-RESPAWN: If this was a LOCAL quest, immediately spawn a replacement
                const completedQuest = get().completedQuests.find(q => q.id === questId);
                if (completedQuest && completedQuest.type === 'LOCAL') {
                    console.log('[QuestStore] Local quest completed, respawning...');
                    setTimeout(() => {
                        get().generateLocalLandmarkQuests();
                    }, 500); // Small delay to avoid race conditions
                }
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

            // Set GPS mode explicitly
            setGPSMode: (useMock: boolean) => {
                set({ useMockGPS: useMock });
            },

            // Toggle Quick Place mode
            toggleQuickPlace: () => {
                set((state) => ({
                    quickPlaceEnabled: !state.quickPlaceEnabled,
                }));
            },

            // Toggle Map Theme
            toggleMapTheme: () => {
                set((state) => ({
                    mapTheme: state.mapTheme === 'cyber' ? 'default' : 'cyber',
                }));
            },

            // Clear all quests (Debug)
            clearQuests: () => {
                set({ activeQuests: [], completedQuests: [], questProgress: new Map(), lastCompletedQuestId: null });
            },

            // Consume the last completed quest ID (reset to null)
            consumeCompletedQuest: () => {
                set({ lastCompletedQuestId: null });
            },

            // Generate Milestone Quests
            generateMilestoneQuests: async () => {
                const { currentLocation, activeQuests, completedQuests, recentQuestHistory } = get();
                if (!currentLocation) return;

                // Check if we already have an active milestone quest
                const hasActiveMilestone = activeQuests.some(q => q.type === 'MILESTONE');
                if (hasActiveMilestone) return;

                try {
                    const { landmarkService } = await import('@/services/LandmarkService');
                    const milestones = await landmarkService.fetchNearbyLandmarks(
                        currentLocation.lat,
                        currentLocation.lng
                    );

                    if (milestones.length === 0) return;

                    // Filter out quests that have already been completed (by ID) OR are in recent history
                    const completedIds = new Set(completedQuests.map(q => q.id));
                    const historySet = new Set(recentQuestHistory);

                    const availableMilestones = milestones.filter(q =>
                        !completedIds.has(q.id) &&
                        !historySet.has(q.id)
                    );

                    if (availableMilestones.length > 0) {
                        // Pick a RANDOM one from the available list
                        const randomIndex = Math.floor(Math.random() * availableMilestones.length);
                        const newQuest = availableMilestones[randomIndex];

                        get().addQuest(newQuest);
                        console.log('[QuestStore] Added new milestone quest:', newQuest.title);
                    } else {
                        console.log('[QuestStore] No fresh milestones available (all in history/completed). Clearing history to allow repeats.');
                        // Optional: Clear history if we run out, or just pick a random one anyway
                        if (milestones.length > 0) {
                            const randomIndex = Math.floor(Math.random() * milestones.length);
                            const newQuest = milestones[randomIndex];
                            get().addQuest(newQuest);
                        }
                    }
                } catch (error) {
                    console.error('[QuestStore] Failed to generate milestone quests:', error);
                }
            },

            // Generate Local Landmark Quests
            generateLocalLandmarkQuests: async (ignoreIds: string[] = []) => {
                const { currentLocation, activeQuests, completedQuests, recentQuestHistory } = get();
                if (!currentLocation) return;

                try {
                    const { landmarkService } = await import('@/services/LandmarkService');

                    // 1. Try fetching local landmarks at 2km
                    let localLandmarks = await landmarkService.fetchLocalLandmarks(
                        currentLocation.lat,
                        currentLocation.lng,
                        2000
                    );

                    // Filter out already active, completed, ignored, OR recent history
                    const activeLocalIds = new Set(activeQuests.filter(q => q.type === 'LOCAL').map(q => q.id));
                    const completedIds = new Set(completedQuests.map(q => q.id));
                    const ignoredIdSet = new Set(ignoreIds);
                    const historySet = new Set(recentQuestHistory);

                    let availableLandmarks = localLandmarks.filter(q =>
                        !activeLocalIds.has(q.id) &&
                        !completedIds.has(q.id) &&
                        !ignoredIdSet.has(q.id) &&
                        !historySet.has(q.id)
                    );

                    // 2. If not enough, try expanding to 3km
                    if (availableLandmarks.length < 2) {
                        console.log('[QuestStore] Not enough landmarks at 2km, expanding to 3km...');
                        localLandmarks = await landmarkService.fetchLocalLandmarks(
                            currentLocation.lat,
                            currentLocation.lng,
                            3000
                        );

                        availableLandmarks = localLandmarks.filter(q =>
                            !activeLocalIds.has(q.id) &&
                            !completedIds.has(q.id) &&
                            !ignoredIdSet.has(q.id) &&
                            !historySet.has(q.id)
                        );
                    }

                    console.log(`[QuestStore] Found ${availableLandmarks.length} valid local landmark candidates`);

                    // SHUFFLE the available landmarks to ensure random selection
                    availableLandmarks = availableLandmarks.sort(() => Math.random() - 0.5);

                    // Calculate how many more LOCAL quests we need (target: 2 active)
                    const currentLocalCount = activeQuests.filter(q => q.type === 'LOCAL').length;
                    let questsNeeded = 2 - currentLocalCount;

                    if (questsNeeded <= 0) {
                        console.log('[QuestStore] Already have 2 LOCAL quests active');
                        return;
                    }

                    // Select quests with minimum 500m spacing between them
                    const selectedQuests: Quest[] = [];
                    const minDistance = 500; // meters

                    for (const candidate of availableLandmarks) {
                        if (selectedQuests.length >= questsNeeded) break;

                        // Check distance from already selected quests AND existing active quests
                        let validSelection = true;
                        const allToCheck = [...activeQuests.filter(q => q.type === 'LOCAL'), ...selectedQuests];

                        for (const existing of allToCheck) {
                            if (candidate.targetCoordinates && existing.targetCoordinates) {
                                const { haversineDistance } = await import('@couch-heroes/shared');
                                const distance = haversineDistance(
                                    candidate.targetCoordinates.lat,
                                    candidate.targetCoordinates.lng,
                                    existing.targetCoordinates.lat,
                                    existing.targetCoordinates.lng
                                );
                                if (distance < minDistance) {
                                    validSelection = false;
                                    break;
                                }
                            }
                        }

                        if (validSelection) {
                            selectedQuests.push(candidate);
                        }
                    }

                    // 3. Fallback: If still need quests, generate "Wilderness" quests
                    questsNeeded -= selectedQuests.length;
                    if (questsNeeded > 0) {
                        console.log(`[QuestStore] Still need ${questsNeeded} quests. Generating Wilderness quests...`);
                        const { questSpawner } = await import('@/services/QuestSpawner');

                        for (let i = 0; i < questsNeeded; i++) {
                            // Generate random point 500m - 1500m away
                            const angle = Math.random() * Math.PI * 2;
                            const dist = 500 + Math.random() * 1000; // 500m to 1500m

                            // Simple flat earth approximation for short distances
                            const latOffset = (dist * Math.cos(angle)) / 111320;
                            const lngOffset = (dist * Math.sin(angle)) / (111320 * Math.cos(currentLocation.lat * Math.PI / 180));

                            const targetLat = currentLocation.lat + latOffset;
                            const targetLng = currentLocation.lng + lngOffset;

                            const wildernessQuest: Quest = {
                                id: `local-wilderness-${Date.now()}-${i}`,
                                type: 'LOCAL',
                                title: 'Wilderness Exploration',
                                description: 'Explore this uncharted area.',
                                lore: 'A quiet spot away from the hustle and bustle. Who knows what you might find?',
                                refreshType: 'NONE',
                                expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
                                targetCoordinates: { lat: targetLat, lng: targetLng },
                                radiusMeters: 40,
                                rewards: [
                                    { type: 'EXP', value: 80 }, // Rounded to nearest 10
                                    { type: 'CURRENCY', value: 20 } // Rounded to nearest 10
                                ]
                            };

                            selectedQuests.push(wildernessQuest);
                        }
                    }

                    // Add the selected quests
                    selectedQuests.forEach(quest => {
                        get().addQuest(quest);
                        console.log('[QuestStore] Added LOCAL quest:', quest.title);
                    });

                } catch (error) {
                    console.error('[QuestStore] Failed to generate local landmark quests:', error);
                }
            },

            // FOG OF WAR: Get quests within 2km of current location
            getNearbyQuests: () => {
                const { activeQuests, currentLocation } = get();

                if (!currentLocation) {
                    return activeQuests; // Show all if no location
                }

                const FOG_OF_WAR_RADIUS = 2000; // 2km in meters

                return activeQuests.filter((quest) => {
                    // Milestone quests are always visible (Global/City-wide)
                    if (quest.type === 'MILESTONE') {
                        return true;
                    }

                    // Movement quests have no specific location, always show
                    if (quest.type === 'MOVEMENT') {
                        return true;
                    }

                    return true; // Default: show quest
                });
            },
            // Rate limiting state for milestone refresh
            milestoneRefreshCount: 0,
            milestoneRefreshResetTime: 0,

            // Force Refresh Milestone Quest (Debug)
            refreshMilestoneQuest: async () => {
                const { currentLocation, activeQuests, milestoneRefreshCount, milestoneRefreshResetTime } = get();
                if (!currentLocation) return;

                // Rate Limit Logic: Max 10 per hour
                const now = Date.now();
                let newCount = milestoneRefreshCount;

                // Reset count if hour has passed
                if (now > milestoneRefreshResetTime) {
                    newCount = 0;
                    set({
                        milestoneRefreshResetTime: now + 60 * 60 * 1000, // 1 hour from now
                        milestoneRefreshCount: 0
                    });
                }

                if (newCount >= 10) {
                    console.warn('[QuestStore] Milestone refresh rate limit reached (10/hour).');
                    alert('Rate limit reached: Max 10 refreshes per hour.');
                    return;
                }

                // Increment count
                set({ milestoneRefreshCount: newCount + 1 });

                console.log('[QuestStore] Force refreshing milestone quest...');

                // Remove existing milestone quest
                const filteredQuests = activeQuests.filter(q => q.type !== 'MILESTONE');
                set({ activeQuests: filteredQuests });

                try {
                    const { landmarkService } = await import('@/services/LandmarkService');

                    // Force fetch fresh landmarks (bypass cache if possible, or just pick a random one)
                    // For now, we'll just re-fetch and pick a RANDOM one instead of the first one to ensure variety
                    const milestones = await landmarkService.fetchNearbyLandmarks(
                        currentLocation.lat,
                        currentLocation.lng
                    );

                    if (milestones.length === 0) {
                        console.log('[QuestStore] No landmarks found for refresh.');
                        return;
                    }

                    // Pick a random milestone from the list
                    const randomQuest = milestones[Math.floor(Math.random() * milestones.length)];

                    // Ensure unique ID to force UI refresh if it's the same landmark
                    const newQuest = {
                        ...randomQuest,
                        id: `milestone-${randomQuest.id}-${Date.now()}`
                    };

                    get().addQuest(newQuest);
                    console.log('[QuestStore] Refreshed milestone quest:', newQuest.title);

                } catch (error) {
                    console.error('[QuestStore] Failed to refresh milestone quest:', error);
                }
            },

            // Export Save Data
            exportSave: () => {
                const state = get();
                const saveData = {
                    activeQuests: state.activeQuests,
                    completedQuests: state.completedQuests,
                    questProgress: Array.from(state.questProgress.entries()),
                    locationHistory: state.locationHistory,
                    useMockGPS: state.useMockGPS,
                    localLandmarkRefreshTime: state.localLandmarkRefreshTime,
                    timestamp: Date.now()
                };
                return JSON.stringify(saveData, null, 2);
            },

            // Import Save Data
            importSave: (json: string) => {
                try {
                    const data = JSON.parse(json);

                    // Basic validation
                    if (!Array.isArray(data.activeQuests) || !Array.isArray(data.questProgress)) {
                        throw new Error('Invalid save file format');
                    }

                    set({
                        activeQuests: data.activeQuests,
                        completedQuests: data.completedQuests || [],
                        questProgress: new Map(data.questProgress),
                        locationHistory: data.locationHistory || [],
                        useMockGPS: data.useMockGPS ?? false,
                        localLandmarkRefreshTime: data.localLandmarkRefreshTime || 0,
                    });

                    return true;
                } catch (error) {
                    console.error('Failed to import save:', error);
                    return false;
                }
            },

            // Reset All Data
            resetData: () => {
                // Set flag to prevent autosave
                sessionStorage.setItem('skip-autosave', 'true');

                // Clear all state
                set({
                    currentLocation: null,
                    locationHistory: [],
                    activeQuests: [],
                    completedQuests: [],
                    questProgress: new Map(),
                    useMockGPS: false,
                    quickPlaceEnabled: false,
                    milestoneRefreshCount: 0,
                    milestoneRefreshResetTime: 0,
                    localLandmarkRefreshTime: 0,
                });

                // Clear localStorage
                localStorage.removeItem('quest-storage');

                console.log('[QuestStore] All data has been reset');
            },
        }),
        {
            name: 'quest-storage',
            partialize: (state) => ({
                activeQuests: state.activeQuests,
                completedQuests: state.completedQuests,
                questProgress: Array.from(state.questProgress.entries()), // Map needs special handling
                locationHistory: state.locationHistory,
                useMockGPS: state.useMockGPS,
                recentQuestHistory: state.recentQuestHistory,
            }),
            // Custom storage to handle Map serialization/deserialization
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    const { state } = JSON.parse(str);
                    return {
                        state: {
                            ...state,
                            questProgress: new Map(state.questProgress),
                        },
                    };
                },
                setItem: (name, value) => {
                    const state = {
                        ...value.state,
                        questProgress: Array.from(value.state.questProgress.entries()),
                    };
                    localStorage.setItem(name, JSON.stringify({ state }));
                },
                removeItem: (name) => localStorage.removeItem(name),
            },
        }
    )
);
