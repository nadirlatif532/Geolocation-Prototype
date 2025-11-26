'use client';

import { useQuestStore } from '@/store/questStore';
import { mockLocationService } from '@/services/MockLocationService';
import { Switch } from '@/components/ui/switch';
import { Navigation, Zap, Radar, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function ControlPanel() {
    const useMockGPS = useQuestStore((state) => state.useMockGPS);
    const toggleGPSMode = useQuestStore((state) => state.toggleGPSMode);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const addQuest = useQuestStore((state) => state.addQuest);
    const userId = useAuthStore((state) => state.userId);

    const [speedPreset, setSpeedPreset] = useState<'walking' | 'running' | 'cycling'>('walking');
    const [isScanning, setIsScanning] = useState(false);

    const handleSpeedChange = (preset: 'walking' | 'running' | 'cycling') => {
        setSpeedPreset(preset);
        mockLocationService.setSpeedPreset(preset);
    };

    const handleScan = async () => {
        if (!currentLocation || isScanning) return;

        setIsScanning(true);
        try {
            const result = await apiService.scanQuests(userId, currentLocation.lat, currentLocation.lng);

            if (result.quests && Array.isArray(result.quests)) {
                result.quests.forEach((quest: import('@couch-heroes/shared').Quest) => {
                    addQuest(quest);
                });
            }
        } catch (error) {
            console.error('Scan failed:', error);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="absolute top-6 left-6 z-10 w-80">
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 to-transparent px-4 py-3 border-b border-border">
                    <h2 className="font-display text-xl font-bold text-primary tracking-wide">CONTROLS</h2>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* GPS Mode Toggle */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Mock GPS Mode</span>
                            <Switch checked={useMockGPS} onCheckedChange={toggleGPSMode} />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {useMockGPS
                                ? 'Test mode enabled. Use keyboard to simulate movement.'
                                : 'Real GPS active. Using device location data.'}
                        </p>
                    </div>

                    {/* Scan Button */}
                    <button
                        onClick={handleScan}
                        disabled={isScanning || !currentLocation}
                        className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg py-2 px-4 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isScanning ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                SCANNING...
                            </>
                        ) : (
                            <>
                                <Radar className="w-4 h-4" />
                                SCAN AREA
                            </>
                        )}
                    </button>

                    {/* Speed Controls (Mock GPS only) */}
                    {useMockGPS && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">Movement Speed</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => handleSpeedChange('walking')}
                                    className={`text-xs py-2 px-3 rounded font-medium transition-all ${speedPreset === 'walking'
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50'
                                        }`}
                                >
                                    🚶 Walk
                                </button>
                                <button
                                    onClick={() => handleSpeedChange('running')}
                                    className={`text-xs py-2 px-3 rounded font-medium transition-all ${speedPreset === 'running'
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50'
                                        }`}
                                >
                                    🏃 Run
                                </button>
                                <button
                                    onClick={() => handleSpeedChange('cycling')}
                                    className={`text-xs py-2 px-3 rounded font-medium transition-all ${speedPreset === 'cycling'
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50'
                                        }`}
                                >
                                    🚴 Bike
                                </button>
                            </div>
                            <div className="bg-muted/30 rounded px-3 py-2">
                                <p className="text-xs text-muted-foreground">
                                    ⌨️ Use <span className="text-primary font-semibold">WASD</span> or{' '}
                                    <span className="text-primary font-semibold">Arrow keys</span> to move
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Location Display */}
                    {currentLocation && (
                        <div className="pt-2 border-t border-border/50 space-y-2">
                            <div className="flex items-center gap-2">
                                <Navigation className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">Current Position</span>
                            </div>
                            <div className="bg-secondary/40 rounded px-3 py-2 font-mono text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Latitude:</span>
                                    <span className="text-foreground">{currentLocation.lat.toFixed(6)}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Longitude:</span>
                                    <span className="text-foreground">{currentLocation.lng.toFixed(6)}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Speed:</span>
                                    <span className="text-primary font-semibold">
                                        {(currentLocation.speed * 3.6).toFixed(1)} km/h
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
