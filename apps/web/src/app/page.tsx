'use client';

import { useEffect } from 'react';
import { useQuestStore } from '@/store/questStore';
import { apiService } from '@/services/api';
import { geolocationService } from '@/services/GeolocationService';
import { mockLocationService } from '@/services/MockLocationService';
import { useWakeLock } from '@/hooks/useWakeLock';
import MapView from '@/components/MapView';
import QuestPanel from '@/components/QuestPanel';
import ControlPanel from '@/components/ControlPanel';
import QuestDialog from '@/components/QuestDialog';
import DebugMenu from '@/components/DebugMenu';

export default function Home() {
    const useMockGPS = useQuestStore((state) => state.useMockGPS);
    const updateLocation = useQuestStore((state) => state.updateLocation);
    const addQuest = useQuestStore((state) => state.addQuest);

    const setGPSMode = useQuestStore((state) => state.setGPSMode);

    // Wake Lock: Prevent screen from sleeping during quest tracking
    useWakeLock();

    // Helper to initialize sample quests (Deferred until location is found)
    const initializeQuests = (lat: number, lng: number) => {
        // Only add quests if none exist
        if (useQuestStore.getState().activeQuests.length > 0) return;

        console.log('[Home] Initializing sample quests at:', lat, lng);

        // Sample movement quest: Walk 1000m
        addQuest({
            id: 'quest-movement-1',
            type: 'MOVEMENT',
            title: 'Morning Walk',
            description: 'Walk 1000 meters to stay active!',
            targetDistanceMeters: 1000,
            currentDistanceMeters: 0,
            rewards: [
                { type: 'EXP', value: 100 },
                { type: 'CURRENCY', value: 50 },
            ],
        });

        // Sample check-in quest: Nearby Landmark (Dynamic based on location)
        // For demo, we'll just put it 100m away
        addQuest({
            id: 'quest-checkin-1',
            type: 'CHECKIN',
            title: 'Visit Local Landmark',
            description: 'Check in at the nearby point of interest',
            targetCoordinates: {
                lat: lat + 0.001, // Roughly 100m North
                lng: lng + 0.001  // Roughly 100m East
            },
            radiusMeters: 100,
            rewards: [
                { type: 'EXP', value: 250 },
                { type: 'ITEM', value: 'Ancient Relic', itemId: 'relic-001' },
            ],
        });

        // Another movement quest
        addQuest({
            id: 'quest-movement-2',
            type: 'MOVEMENT',
            title: 'Daily Exercise',
            description: 'Complete 5km to maintain your hero status',
            targetDistanceMeters: 5000,
            currentDistanceMeters: 0,
            rewards: [
                { type: 'EXP', value: 500 },
                { type: 'CURRENCY', value: 200 },
            ],
        });
    };

    // Initialize location tracking
    useEffect(() => {
        const userId = 'local-user'; // TODO: Get from auth store when auth is fully integrated
        const service = useMockGPS ? mockLocationService : geolocationService;

        console.log(`[Home] Starting location service. Mock Mode: ${useMockGPS}`);

        service.startWatching(
            (location) => {
                // Update local state
                updateLocation(location);

                // Send to backend with offline queue support
                apiService.updateLocation(userId, location).catch((error) => {
                    console.error('[Home] Failed to send location update:', error);
                });

                // Initialize quests if this is the first location update
                // We check if activeQuests is empty to ensure we only do this once
                const state = useQuestStore.getState();
                if (state.activeQuests.length === 0) {
                    initializeQuests(location.lat, location.lng);

                    // Also try to scan for server-side quests
                    apiService.scanQuests(userId, location.lat, location.lng).then((result) => {
                        if (result.quests && Array.isArray(result.quests)) {
                            result.quests.forEach((quest) => addQuest(quest));
                        }
                    }).catch(err => console.error('[Home] Auto-scan failed:', err));
                }
            },
            (error) => {
                console.error('Location error:', error);

                // FALLBACK LOGIC: If Real GPS fails, switch to Mock Mode (Athens)
                if (!useMockGPS) {
                    console.warn('[Home] Real GPS failed or denied. Falling back to Athens (Mock Mode).');
                    setGPSMode(true); // This will trigger the effect again with mockLocationService
                }
            }
        );

        return () => {
            service.stopWatching();
        };
    }, [useMockGPS, updateLocation, addQuest, setGPSMode]);

    return (
        <main className="relative w-screen h-screen overflow-hidden">
            {/* LAYER 1: Map (Bottom) */}
            <MapView className="z-0" />

            {/* LAYER 2: Game Canvas (Middle - Transparent) */}
            {/* TODO: Add canvas for particles, effects, animations */}

            {/* LAYER 3: UI Overlay (Top) */}
            <QuestPanel />
            <ControlPanel />
            <QuestDialog />
            <DebugMenu />

            {/* Debug Info */}
            <div className="absolute bottom-6 left-6 z-10 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2.5 shadow-xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium text-primary">
                        {useMockGPS ? '🎮 Mock GPS Active' : '📍 Real GPS Active'}
                    </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                    {useMockGPS ? 'Use WASD or Arrow keys' : 'Using device location'}
                </div>
            </div>
        </main>
    );
}
