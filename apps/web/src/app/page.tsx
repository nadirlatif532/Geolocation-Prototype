'use client';

import { useEffect } from 'react';
import { useQuestStore } from '@/store/questStore';
import { geolocationService } from '@/services/GeolocationService';
import { mockLocationService } from '@/services/MockLocationService';
import { useWakeLock } from '@/hooks/useWakeLock';
import MapView from '@/components/MapView';
import QuestPanel from '@/components/QuestPanel';
import ControlPanel from '@/components/ControlPanel';

export default function Home() {
    const useMockGPS = useQuestStore((state) => state.useMockGPS);
    const updateLocation = useQuestStore((state) => state.updateLocation);
    const addQuest = useQuestStore((state) => state.addQuest);

    // Wake Lock: Prevent screen from sleeping during quest tracking
    useWakeLock();

    // Initialize location tracking
    useEffect(() => {
        const service = useMockGPS ? mockLocationService : geolocationService;

        service.startWatching(
            (location) => {
                updateLocation(location);
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
            targetCoordinates: { lat: 37.9715, lng: 23.7257 }, // Acropolis coordinates
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

            {/* Debug Info */}
            <div className="absolute bottom-4 left-4 z-10 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-xs font-mono">
                <div className="text-cyber-blue">
                    {useMockGPS ? '🎮 Mock GPS Active' : '📍 Real GPS Active'}
                </div>
                <div className="text-muted-foreground">
                    {useMockGPS ? 'Use WASD or Arrow keys to move' : 'Using device location'}
                </div>
            </div>
        </main>
    );
}
