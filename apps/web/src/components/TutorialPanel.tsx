'use client';

import { useState } from 'react';
import { X, MapPin, Target, HelpCircle, Settings, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialPanelProps {
    onClose: () => void;
}

export default function TutorialPanel({ onClose }: TutorialPanelProps) {
    const [activeTab, setActiveTab] = useState<'goal' | 'movement' | 'quests' | 'controls'>('goal');

    const tabs = [
        { id: 'goal', label: 'Goal', icon: Target },
        { id: 'movement', label: 'Move', icon: Navigation },
        { id: 'quests', label: 'Quests', icon: MapPin },
        { id: 'controls', label: 'Controls', icon: Settings },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md md:max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-primary/10 px-4 py-3 border-b border-border flex justify-between items-center">
                    <div className="flex items-center gap-2 text-primary">
                        <HelpCircle className="w-5 h-5" />
                        <h2 className="font-display font-bold text-lg tracking-wide">HOW TO PLAY</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-primary/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border bg-secondary/20 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${isActive
                                    ? 'border-primary text-primary bg-primary/5'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'goal' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                                <h3 className="font-bold text-primary mb-2">Become a Couch Hero!</h3>
                                <p className="text-sm text-foreground">
                                    Your mission is to explore the real world, complete quests, and level up your character.
                                    Turn your daily walks into an epic RPG adventure!
                                </p>
                            </div>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex gap-3">
                                    <span className="bg-secondary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                                    <span>Find quests on the map around your location.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="bg-secondary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                                    <span>Physically travel to quest locations or complete distance goals.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="bg-secondary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                                    <span>Earn <strong>XP</strong> and <strong>Rewards</strong> to upgrade your stats.</span>
                                </li>
                            </ul>
                        </div>
                    )}

                    {activeTab === 'movement' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="font-bold text-foreground">Movement Modes</h3>

                            <div className="space-y-3">
                                <div className="p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MapPin className="w-4 h-4 text-green-500" />
                                        <span className="font-bold text-sm">Real GPS (Default)</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Uses your device's actual location. Walk around outside to move your character on the map.
                                        Best for outdoor play!
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Settings className="w-4 h-4 text-orange-500" />
                                        <span className="font-bold text-sm">Mock Mode (Debug)</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Simulate movement using keyboard controls (WASD) or on-screen buttons.
                                        Useful for testing indoors. Enable this in the <strong>Controls</strong> panel.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'quests' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="font-bold text-foreground">Quest Types</h3>

                            <div className="grid gap-3">
                                <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                                        <MapPin className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Movement Quests</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Reach a target distance (e.g., "Walk 1km"). Great for jogging or hiking.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                                    <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                                        <Target className="w-4 h-4 text-pink-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Check-in Quests</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Go to a specific location on the map. You must be within range to complete it.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                                        <span className="font-bold text-yellow-500">?</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Mystery Quests</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Hidden objectives or rare finds. Explore the map to reveal them!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'controls' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="font-bold text-foreground">Game Controls</h3>
                            <ul className="space-y-4 text-sm text-muted-foreground">
                                <li>
                                    <strong className="text-foreground block mb-1">Scanning</strong>
                                    Use the <strong>Scan Area</strong> button in the Controls panel to find new quests nearby.
                                    Scanning has a cooldown, so use it wisely when you enter a new area.
                                </li>
                                <li>
                                    <strong className="text-foreground block mb-1">Map Navigation</strong>
                                    Drag to pan, pinch to zoom. Tap on quest icons to see details.
                                    Double-tap (or right-click) to quick-teleport in Mock Mode.
                                </li>
                                <li>
                                    <strong className="text-foreground block mb-1">Drawers (Mobile)</strong>
                                    Use the side buttons to open the <strong>Quests</strong>, <strong>Controls</strong>, and <strong>Debug</strong> panels.
                                    Tap the button again or swipe to close.
                                </li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-secondary/10 flex justify-end">
                    <Button onClick={onClose} className="w-full sm:w-auto">
                        Got it, let's play!
                    </Button>
                </div>
            </div>
        </div>
    );
}
