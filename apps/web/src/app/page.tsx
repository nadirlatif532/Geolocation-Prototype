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

    // Wake Lock: Prevent screen from sleeping during quest tracking
    useWakeLock();

    // Initialize location tracking
    useEffect(() => {
        const userId = 'local-user'; // TODO: Get from auth store when auth is fully integrated
        const service = useMockGPS ? mockLocationService : geolocationService;

        service.startWatching(
            (location) => {
                // Update local state
                updateLocation(location);

                // Send to backend with offline queue support
                apiService.updateLocation(userId, location).catch((error) => {
                    console.error('[Home] Failed to send location update:', error);
                    // Note: apiService already handles offline queueing, this is just logging
                });
            },
            (error) => {
                console.error('Location error:', error);
            }
        );

        return () => {
            service.stopWatching();
        };
    }, [useMockGPS, updateLocation]);

    // Add sample quests on mount
    useEffect(() => {
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

        // Sample check-in quest: Visit Acropolis
        addQuest({
            id: 'quest-checkin-1',
            type: 'CHECKIN',
            title: 'Visit the Acropolis',
            description: 'Check in at the historic Acropolis of Athens',
            targetCoordinates: { lat: 37.9715, lng: 23.7257 },
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
    }, [addQuest]);

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
