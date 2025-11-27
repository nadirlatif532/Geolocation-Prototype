'use client';

import { useEffect, useState } from 'react';
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
import TutorialPanel from '@/components/TutorialPanel';
import { HelpCircle } from 'lucide-react';

export default function Home() {
    const useMockGPS = useQuestStore((state) => state.useMockGPS);
    const updateLocation = useQuestStore((state) => state.updateLocation);
    const addQuest = useQuestStore((state) => state.addQuest);
    const setGPSMode = useQuestStore((state) => state.setGPSMode);

    // Drawer State: which drawer is open ('none', 'quests', 'controls', 'debug')
    const [openDrawer, setOpenDrawer] = useState<'none' | 'quests' | 'controls' | 'debug'>('none');
    const [showTutorial, setShowTutorial] = useState(false);

    // Wake Lock: Prevent screen from sleeping during quest tracking
    useWakeLock();

    // Helper to initialize quests (Deferred until location is found)
    const initializeQuests = async (lat: number, lng: number) => {
        // Only add quests if none exist
        if (useQuestStore.getState().activeQuests.length > 0) return;

        console.log('[Home] Initializing quests at:', lat, lng);

        // Generate milestone quest (1 quest) - uses deduplication logic in store
        await useQuestStore.getState().generateMilestoneQuests();

        // Generate local landmark quests (2 quests) - uses deduplication logic in store
        await useQuestStore.getState().generateLocalLandmarkQuests();

        // Generate mystery quests (5 quests)
        try {
            const result = await apiService.scanQuests('local-user', lat, lng);
            if (result.quests && Array.isArray(result.quests)) {
                result.quests.forEach((quest) => addQuest(quest));
            }
        } catch (error) {
            console.error('[Home] Failed to generate mystery quests:', error);
        }

        // Add movement quests
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

        // If switching to mock GPS, reset to Athens and recenter map
        if (useMockGPS) {
            mockLocationService.resetToAthens();
            const athensLocation = mockLocationService.getLastLocation();
            updateLocation(athensLocation);

            // Recenter map to Athens after a short delay to ensure map is ready
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('map-recenter', {
                    detail: { lat: athensLocation.lat, lng: athensLocation.lng }
                }));
            }, 100);
        }

        // Check if GPS permission is already granted and get immediate position
        if (!useMockGPS && 'permissions' in navigator) {
            navigator.permissions.query({ name: 'geolocation' as PermissionName })
                .then(result => {
                    if (result.state === 'granted') {
                        console.log('[Home] GPS permission already granted. Getting immediate position...');

                        // Get current position immediately to spawn quests faster
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                const location = {
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude,
                                    timestamp: Date.now(),
                                    speed: position.coords.speed || 0
                                };

                                updateLocation(location);

                                // Initialize quests immediately
                                const state = useQuestStore.getState();
                                if (state.activeQuests.length === 0) {
                                    console.log('[Home] Spawning quests immediately with granted permission');
                                    initializeQuests(location.lat, location.lng)
                                        .catch(err => console.error('[Home] Quest initialization failed:', err));
                                }
                            },
                            (error) => {
                                console.warn('[Home] Immediate position fetch failed:', error);
                                // Will fallback to waiting for first update from startWatching
                            }
                        );
                    }
                })
                .catch(err => {
                    console.warn('[Home] Permissions API not supported:', err);
                    // Will fallback to waiting for first update from startWatching
                });
        } else if (useMockGPS) {
            // For mock GPS, initialize immediately at Athens
            const mockLocation = { lat: 37.9838, lng: 23.7275 };
            const state = useQuestStore.getState();
            if (state.activeQuests.length === 0) {
                console.log('[Home] Spawning quests immediately in mock mode');
                initializeQuests(mockLocation.lat, mockLocation.lng)
                    .catch(err => console.error('[Home] Quest initialization failed:', err));
            }
        }

        // Start continuous watching
        service.startWatching(
            (location) => {
                // Update local state
                updateLocation(location);

                // Send to backend with offline queue support
                apiService.updateLocation(userId, location).catch((error) => {
                    console.error('[Home] Failed to send location update:', error);
                });

                // Initialize quests if this is the first location update (fallback)
                // We check if activeQuests is empty to ensure we only do this once
                const state = useQuestStore.getState();
                if (state.activeQuests.length === 0) {
                    initializeQuests(location.lat, location.lng)
                        .catch(err => console.error('[Home] Quest initialization failed:', err));
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

    const toggleDrawer = (drawer: 'quests' | 'controls' | 'debug') => {
        setOpenDrawer(openDrawer === drawer ? 'none' : drawer);
    };

    return (
        <main className="relative w-screen h-screen overflow-hidden">
            {/* Map Background */}
            <MapView className="absolute inset-0 z-0" />

            {/* Couch Heroes Logo (Mobile - Bottom Right) */}
            <div className="absolute bottom-6 right-6 z-10 md:hidden">
                <img
                    src="/couch-heroes-logo.png"
                    alt="Couch Heroes"
                    className="h-12 w-auto opacity-90"
                />
            </div>

            {/* Floating Drawer System (Mobile Only) */}
            <div className="md:hidden">
                {/* Quests Drawer */}
                <div
                    className={`fixed top-[calc(50%-110px)] left-0 z-40 transition-transform duration-300 ease-in-out -translate-y-1/2 ${openDrawer === 'quests' ? 'translate-x-0' : '-translate-x-full'
                        }`}
                    style={{ maxWidth: '80vw' }}
                >
                    <div className="flex items-start">
                        <QuestPanel className="bg-card/95 backdrop-blur-sm rounded-r-xl shadow-2xl border-r border-t border-b border-border" />
                        <button
                            onClick={() => toggleDrawer('quests')}
                            className={`ml-1 px-2 py-6 rounded-r-lg transition-colors shadow-lg ${openDrawer === 'quests'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card/95 backdrop-blur-sm text-muted-foreground border border-border'
                                }`}
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                            <span className="text-sm font-bold tracking-wider">QUESTS</span>
                        </button>
                    </div>
                </div>

                {/* Controls Drawer */}
                <div
                    className={`fixed top-1/2 -translate-y-1/2 left-0 z-40 transition-transform duration-300 ease-in-out ${openDrawer === 'controls' ? 'translate-x-0' : '-translate-x-full'
                        }`}
                    style={{ maxWidth: '80vw' }}
                >
                    <div className="flex items-start">
                        <ControlPanel className="bg-card/95 backdrop-blur-sm rounded-r-xl shadow-2xl border-r border-t border-b border-border" />
                        <button
                            onClick={() => toggleDrawer('controls')}
                            className={`ml-1 px-2 py-6 rounded-r-lg transition-colors shadow-lg ${openDrawer === 'controls'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card/95 backdrop-blur-sm text-muted-foreground border border-border'
                                }`}
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                            <span className="text-sm font-bold tracking-wider">CONTROLS</span>
                        </button>
                    </div>
                </div>

                {/* Debug Drawer */}
                <div
                    className={`fixed top-[calc(50%+110px)] left-0 z-40 transition-transform duration-300 ease-in-out -translate-y-1/2 ${openDrawer === 'debug' ? 'translate-x-0' : '-translate-x-full'
                        }`}
                    style={{ maxWidth: '80vw' }}
                >
                    <div className="flex items-start">
                        <div className="bg-card/95 backdrop-blur-sm rounded-r-xl shadow-2xl border-r border-t border-b border-border max-h-[60vh] overflow-hidden">
                            <DebugMenu embedded={true} />
                        </div>
                        <button
                            onClick={() => toggleDrawer('debug')}
                            className={`ml-1 px-2 py-6 rounded-r-lg transition-colors shadow-lg ${openDrawer === 'debug'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card/95 backdrop-blur-sm text-muted-foreground border border-border'
                                }`}
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                            <span className="text-sm font-bold tracking-wider">DEBUG</span>
                        </button>
                    </div>
                </div>

                {/* Floating Buttons (when drawers are closed) */}
                {openDrawer !== 'quests' && (
                    <button
                        onClick={() => toggleDrawer('quests')}
                        className="fixed top-[calc(50%-110px)] left-0 z-30 px-2 py-6 rounded-r-lg bg-card/95 backdrop-blur-sm text-muted-foreground border border-border shadow-lg transition-all hover:bg-primary hover:text-primary-foreground -translate-y-1/2"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                        <span className="text-sm font-bold tracking-wider">QUESTS</span>
                    </button>
                )}

                {openDrawer !== 'controls' && (
                    <button
                        onClick={() => toggleDrawer('controls')}
                        className="fixed top-1/2 -translate-y-1/2 left-0 z-30 px-2 py-6 rounded-r-lg bg-card/95 backdrop-blur-sm text-muted-foreground border border-border shadow-lg transition-all hover:bg-primary hover:text-primary-foreground"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                        <span className="text-sm font-bold tracking-wider">CONTROLS</span>
                    </button>
                )}

                {openDrawer !== 'debug' && (
                    <button
                        onClick={() => toggleDrawer('debug')}
                        className="fixed top-[calc(50%+110px)] left-0 z-30 px-2 py-6 rounded-r-lg bg-card/95 backdrop-blur-sm text-muted-foreground border border-border shadow-lg transition-all hover:bg-primary hover:text-primary-foreground -translate-y-1/2"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                        <span className="text-sm font-bold tracking-wider">DEBUG</span>
                    </button>
                )}
            </div>

            {/* Desktop Layout (Unchanged) */}
            <div className="hidden md:block absolute inset-0 pointer-events-none">
                <QuestPanel className="absolute top-6 right-20 z-20 pointer-events-auto" />
                <ControlPanel className="absolute top-6 left-6 z-20 pointer-events-auto" />
                <DebugMenu className="pointer-events-auto" />
            </div>

            {/* Quest Dialog (Mobile & Desktop) */}
            <QuestDialog />

            {/* Debug Info (Desktop Only) */}
            <div className="absolute bottom-20 left-6 z-10 bg-card/95 backdrop-blur-sm border border-primary/30 rounded-lg px-4 py-2.5 shadow-xl hidden md:block">
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

            {/* Couch Heroes Logo (Bottom Right) */}
            <div className="absolute bottom-6 right-6 z-10 hidden md:block">
                <img
                    src="/couch-heroes-logo.png"
                    alt="Couch Heroes"
                    className="h-16 w-auto opacity-90 hover:opacity-100 transition-opacity"
                />
            </div>

            {/* Tutorial Button (Top Left) */}
            <button
                onClick={() => setShowTutorial(true)}
                className="absolute top-6 left-6 z-20 bg-card/95 backdrop-blur-sm p-3 rounded-full shadow-lg border border-border hover:bg-primary hover:text-primary-foreground transition-all md:hidden"
                title="How to Play"
            >
                <HelpCircle className="w-6 h-6" />
            </button>

            {/* Desktop Tutorial Button */}
            <button
                onClick={() => setShowTutorial(true)}
                className="absolute top-6 right-6 z-20 bg-card/95 backdrop-blur-sm p-3 rounded-full shadow-lg border border-border hover:bg-primary hover:text-primary-foreground transition-all hidden md:block"
                title="How to Play"
            >
                <HelpCircle className="w-6 h-6" />
            </button>

            {/* Tutorial Modal */}
            {showTutorial && <TutorialPanel onClose={() => setShowTutorial(false)} />}
        </main>
    );
}
