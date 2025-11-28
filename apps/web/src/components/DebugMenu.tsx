'use client';

import { useState, useEffect } from 'react';
import { useQuestStore } from '@/store/questStore';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { Bug, MapPin, RefreshCw, PlusCircle, X, Minus, Landmark, Move } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export default function DebugMenu({ className, embedded = false }: { className?: string; embedded?: boolean }) {
    const [isOpen, setIsOpen] = useState(embedded);
    const [isMinimized, setIsMinimized] = useState(false);

    // Reset minimized state when in embedded mode (mobile drawer)
    useEffect(() => {
        if (embedded) {
            setIsMinimized(false);
        }
    }, [embedded]);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const addQuest = useQuestStore((state) => state.addQuest);
    const clearQuests = useQuestStore((state) => state.clearQuests);
    const activeQuests = useQuestStore((state) => state.activeQuests);
    const userId = useAuthStore((state) => state.userId);

    const quickPlaceEnabled = useQuestStore((state) => state.quickPlaceEnabled);
    const toggleQuickPlace = useQuestStore((state) => state.toggleQuickPlace);

    const handleSpawnTestQuest = () => {
        console.log('[DebugMenu] Spawning test quest...', currentLocation);
        if (!currentLocation) {
            console.error('[DebugMenu] Cannot spawn quest: No current location');
            return;
        }

        // Calculate a point roughly 5 meters away (0.00005 degrees is approx 5.5m)
        const latOffset = (Math.random() - 0.5) * 0.0001;
        const lngOffset = (Math.random() - 0.5) * 0.0001;

        const newQuest = {
            id: `debug-quest-${Date.now()}`,
            type: 'MYSTERY' as const,
            title: 'Debug Quest',
            description: 'A test quest spawned 5m away.',
            targetCoordinates: {
                lat: currentLocation.lat + latOffset,
                lng: currentLocation.lng + lngOffset,
            },
            radiusMeters: 30,
            rewards: [{ type: 'EXP' as const, value: 10 }],
        };

        console.log('[DebugMenu] Adding quest:', newQuest);
        addQuest(newQuest);
    };

    const handleRespawnMysteryQuests = async () => {
        if (!currentLocation) return;

        // 1. Remove existing MYSTERY quests
        const nonMysteryQuests = activeQuests.filter(q => q.type !== 'MYSTERY');
        useQuestStore.setState({ activeQuests: nonMysteryQuests });

        // 2. Import spawner and generate 5 new ones
        const { questSpawner } = await import('@/services/QuestSpawner');
        const newQuests = await questSpawner.spawnLocalQuests(currentLocation.lat, currentLocation.lng);

        // 3. Add them to store
        newQuests.forEach(q => addQuest(q));
        console.log('[DebugMenu] Respawned 5 Mystery Quests');
    };

    const handleRespawnLocalQuests = async () => {
        if (!currentLocation) return;

        // 1. Identify existing LOCAL quests to ignore in next generation
        const existingLocalQuests = activeQuests.filter(q => q.type === 'LOCAL');
        const ignoreIds = existingLocalQuests.map(q => q.id);

        // Add to history so they don't come back immediately
        useQuestStore.getState().addToQuestHistory(ignoreIds);

        // 2. Remove existing LOCAL quests
        const nonLocalQuests = activeQuests.filter(q => q.type !== 'LOCAL');
        useQuestStore.setState({ activeQuests: nonLocalQuests });

        // 3. Generate NEW local quests
        await useQuestStore.getState().generateLocalLandmarkQuests();

        // Dispatch event for MapView to handle flyTo
        window.dispatchEvent(new CustomEvent('map-recenter', {
            detail: { lat: currentLocation.lat, lng: currentLocation.lng }
        }));
    };

    const handleTeleportToCenter = () => {
        // Dispatch event for MapView to handle teleport
        window.dispatchEvent(new CustomEvent('debug-teleport-center'));
    };

    const handleRespawnMilestoneQuest = () => {
        const milestone = activeQuests.find(q => q.type === 'MILESTONE');
        if (milestone) {
            useQuestStore.getState().addToQuestHistory([milestone.id]);
        }
        useQuestStore.getState().refreshMilestoneQuest();
    };

    const handleResetMap = () => {
        if (!currentLocation) return;
        window.dispatchEvent(new CustomEvent('map-recenter', {
            detail: { lat: currentLocation.lat, lng: currentLocation.lng }
        }));
    };

    const handleRespawnQuests = async () => {
        if (!currentLocation) return;

        clearQuests();

        try {
            // Use the scan API to generate new quests at current location
            const result = await apiService.scanQuests(userId, currentLocation.lat, currentLocation.lng);
            if (result.quests && Array.isArray(result.quests)) {
                result.quests.forEach((quest: import('@couch-heroes/shared').Quest) => addQuest(quest));
            }
        } catch (error) {
            console.error('Failed to respawn quests:', error);
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    if (!isOpen && !embedded) {
        return (
            <button
                onClick={() => { setIsOpen(true); setIsMinimized(false); }}
                className={cn(
                    "fixed bottom-6 left-6 z-50 bg-destructive text-destructive-foreground p-3 rounded-full shadow-lg hover:bg-destructive/90 transition-all",
                    className
                )}
                title="Debug Menu"
            >
                <Bug className="w-6 h-6" />
            </button>
        );
    }

    const containerClasses = cn(
        embedded
            ? "w-full bg-card"
            : `fixed bottom-6 left-6 z-50 bg-card border border-destructive/50 rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${isMinimized ? 'w-64 h-12' : 'w-64'}`,
        className
    );

    return (
        <div className={containerClasses}>
            <div className={`bg-destructive/10 p-3 border-b border-destructive/20 flex justify-between items-center h-12 ${embedded ? 'rounded-t-lg' : ''}`}>
                <h3 className="font-bold text-destructive flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    DEBUG TOOLS
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-destructive/10"
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? <PlusCircle className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </button>
                    {!embedded && (
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-destructive/10"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {!isMinimized && (
                <div className="p-2 space-y-2 animate-in slide-in-from-top-2 fade-in">
                    <button
                        onClick={handleSpawnTestQuest}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
                    >
                        <PlusCircle className="w-4 h-4 text-green-500" />
                        Spawn Quest (5m)
                    </button>

                    <button
                        onClick={handleRespawnMysteryQuests}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
                    >
                        <RefreshCw className="w-4 h-4 text-purple-500" />
                        Respawn Mystery Quests
                    </button>

                    <button
                        onClick={handleRespawnLocalQuests}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
                    >
                        <Landmark className="w-4 h-4 text-cyan-500" />
                        Respawn Local Quests
                    </button>

                    <button
                        onClick={handleRespawnMilestoneQuest}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
                    >
                        <RefreshCw className="w-4 h-4 text-yellow-500" />
                        Respawn Milestone Quest
                    </button>

                    <button
                        onClick={handleResetMap}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
                    >
                        <MapPin className="w-4 h-4 text-blue-500" />
                        Reset Map to Player
                    </button>

                    <div className="pt-2 border-t border-destructive/20">
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-sm font-medium text-foreground">Quick Place</span>
                            <Switch
                                checked={quickPlaceEnabled}
                                onCheckedChange={toggleQuickPlace}
                            />
                        </div>
                        <p className="px-3 text-xs text-muted-foreground">
                            Right-click map to teleport
                        </p>
                        <button
                            onClick={handleTeleportToCenter}
                            className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
                        >
                            <Move className="w-4 h-4 text-cyan-500" />
                            Teleport to Center
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
