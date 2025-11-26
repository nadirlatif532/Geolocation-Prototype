'use client';

import { useQuestStore } from '@/store/questStore';
import { mockLocationService } from '@/services/MockLocationService';
import { Switch } from '@/components/ui/switch';
import { Settings, Zap } from 'lucide-react';
import { useState } from 'react';

export default function ControlPanel() {
    const useMockGPS = useQuestStore((state) => state.useMockGPS);
    const toggleGPSMode = useQuestStore((state) => state.toggleGPSMode);
    const currentLocation = useQuestStore((state) => state.currentLocation);

    const [speedPreset, setSpeedPreset] = useState<'walking' | 'running' | 'cycling'>('walking');

    const handleSpeedChange = (preset: 'walking' | 'running' | 'cycling') => {
        setSpeedPreset(preset);
        mockLocationService.setSpeedPreset(preset);
    };

    return (
        <div className="absolute top-4 right-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 space-y-4 min-w-[250px]">
            <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyber-blue" />
                <h2 className="font-display text-lg font-bold">Controls</h2>
            </div>

            {/* GPS Mode Toggle */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Use Mock GPS</span>
                    <Switch checked={useMockGPS} onCheckedChange={toggleGPSMode} />
                </div>
                <p className="text-xs text-muted-foreground">
                    {useMockGPS
                        ? 'Test mode: Use keyboard to simulate movement'
                        : 'Real GPS: Uses device location'}
                </p>
            </div>

            {/* Speed Preset (only for mock GPS) */}
            {useMockGPS && (
                <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyber-purple" />
                        <span className="text-sm font-medium">Movement Speed</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handleSpeedChange('walking')}
                            className={`text-xs py-1.5 px-2 rounded transition-colors ${speedPreset === 'walking'
                                    ? 'bg-cyber-blue text-white'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                }`}
                        >
                            🚶 Walk
                        </button>
                        <button
                            onClick={() => handleSpeedChange('running')}
                            className={`text-xs py-1.5 px-2 rounded transition-colors ${speedPreset === 'running'
                                    ? 'bg-cyber-purple text-white'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                }`}
                        >
                            🏃 Run
                        </button>
                        <button
                            onClick={() => handleSpeedChange('cycling')}
                            className={`text-xs py-1.5 px-2 rounded transition-colors ${speedPreset === 'cycling'
                                    ? 'bg-cyber-pink text-white'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                }`}
                        >
                            🚴 Bike
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Use WASD or Arrow keys to move</p>
                </div>
            )}

            {/* Current Location Display */}
            {currentLocation && (
                <div className="pt-2 border-t border-border space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Current Position</div>
                    <div className="font-mono text-xs">
                        <div>Lat: {currentLocation.lat.toFixed(6)}°</div>
                        <div>Lng: {currentLocation.lng.toFixed(6)}°</div>
                        <div>Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h</div>
                    </div>
                </div>
            )}
        </div>
    );
}
