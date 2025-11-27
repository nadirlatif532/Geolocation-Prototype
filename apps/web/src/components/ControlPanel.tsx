'use client';

import { useQuestStore } from '@/store/questStore';
import { mockLocationService } from '@/services/MockLocationService';
import { Switch } from '@/components/ui/switch';
import { Navigation, Zap, Radar, Loader2, Save, Upload, Download, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function ControlPanel({ className }: { className?: string }) {
    const useMockGPS = useQuestStore((state) => state.useMockGPS);
    const toggleGPSMode = useQuestStore((state) => state.toggleGPSMode);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const addQuest = useQuestStore((state) => state.addQuest);
    const exportSave = useQuestStore((state) => state.exportSave);
    const importSave = useQuestStore((state) => state.importSave);
    const resetData = useQuestStore((state) => state.resetData);
    const userId = useAuthStore((state) => state.userId);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [speedPreset, setSpeedPreset] = useState<'walking' | 'running' | 'cycling'>('walking');
    const [isScanning, setIsScanning] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const handleSpeedChange = (preset: 'walking' | 'running' | 'cycling') => {
        setSpeedPreset(preset);
        mockLocationService.setSpeedPreset(preset);
    };

    const handleScan = async () => {
        if (!currentLocation || isScanning) return;

        setIsScanning(true);
        // Clear existing quests to replace them (similar to respawn)
        useQuestStore.getState().clearQuests();

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
    const handleExport = () => {
        const json = exportSave();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `couch-heroes-save-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const success = importSave(content);
                if (success) {
                    alert('Save loaded successfully!');
                    window.location.reload(); // Reload to ensure clean state
                } else {
                    alert('Failed to load save file.');
                }
            }
        };
        reader.readAsText(file);
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleResetData = () => {
        if (!showResetConfirm) {
            setShowResetConfirm(true);
            return;
        }

        // Double confirmation passed, reset data
        resetData();

        // Reload the page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className={`w-full md:w-80 pointer-events-none ${className || ''}`} />;
    }

    return (
        <div className={`w-full md:w-80 pointer-events-none ${className || ''}`}>
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl pointer-events-auto">
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

                    {/* Data Management */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Save className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">Data Management</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleExport}
                                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50 rounded-lg py-2 px-3 text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-3 h-3" />
                                Export Save
                            </button>
                            <button
                                onClick={handleImportClick}
                                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50 rounded-lg py-2 px-3 text-xs font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Upload className="w-3 h-3" />
                                Import Save
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden"
                            />
                        </div>
                        <button
                            onClick={handleResetData}
                            onBlur={() => setTimeout(() => setShowResetConfirm(false), 200)}
                            className={`w-full ${showResetConfirm
                                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                                : 'bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/50'
                                } rounded-lg py-2 px-3 text-xs font-medium transition-all flex items-center justify-center gap-2`}
                        >
                            <Trash2 className="w-3 h-3" />
                            {showResetConfirm ? 'Click Again to Confirm Reset' : 'Reset All Data'}
                        </button>
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
