'use client';

import { useEffect, useState } from 'react';
import { useQuestStore } from '@/store/questStore';
import { QuestManager } from '@/lib/QuestManager';
import { formatDistance } from '@couch-heroes/shared';
import { MapPin, Target, Trophy, Loader2 } from 'lucide-react';

export default function QuestPanel({ className }: { className?: string }) {
    const nearbyQuests = useQuestStore((state) => state.getNearbyQuests());
    const completedQuests = useQuestStore((state) => state.completedQuests);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const locationHistory = useQuestStore((state) => state.locationHistory);
    const isLoadingQuests = useQuestStore((state) => state.isLoadingQuests);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch by rendering empty state until mounted
    if (!mounted) {
        return (
            <div className={`w-full md:w-80 ${className || ''}`}>
                <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-primary/20 to-transparent px-4 py-3 border-b border-border">
                        <h2 className="font-display text-xl font-bold text-primary tracking-wide">QUESTS</h2>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show loading while quests are being fetched
    if (isLoadingQuests && nearbyQuests.length === 0) {
        return (
            <div className={`w-full md:w-80 ${className || ''}`}>
                <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-primary/20 to-transparent px-4 py-3 border-b border-border">
                        <h2 className="font-display text-xl font-bold text-primary tracking-wide">QUESTS</h2>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Discovering quests nearby...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (nearbyQuests.length === 0 && completedQuests.length === 0) {
        return (
            <div className={`w-full md:w-80 ${className || ''}`}>
                <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-primary/20 to-transparent px-4 py-3 border-b border-border">
                        <h2 className="font-display text-xl font-bold text-primary tracking-wide">QUESTS</h2>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-muted-foreground">No nearby quests. Explore to discover more!</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full md:w-80 flex flex-col max-h-[70vh] ${className || ''}`}>
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl flex flex-col max-h-full">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 to-transparent px-4 py-3 border-b border-border flex-shrink-0 flex justify-between items-center">
                    <h2 className="font-display text-xl font-bold text-primary tracking-wide">QUESTS</h2>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {/* Milestone Quests Section */}
                    {nearbyQuests
                        .filter(q => q.type === 'MILESTONE')
                        .map((quest) => {
                            const progress = QuestManager.getProgressPercentage(
                                quest,
                                currentLocation,
                                locationHistory
                            );

                            return (
                                <div
                                    key={quest.id}
                                    onClick={() => {
                                        if (quest.targetCoordinates) {
                                            window.dispatchEvent(new CustomEvent('quest-focus', {
                                                detail: {
                                                    lat: quest.targetCoordinates.lat,
                                                    lng: quest.targetCoordinates.lng
                                                }
                                            }));
                                        }
                                    }}
                                    className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 space-y-3 hover:border-yellow-400 transition-all relative overflow-hidden group cursor-pointer"
                                >
                                    {/* Gold Glow Effect */}
                                    <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    {/* Quest Header */}
                                    <div className="flex items-start justify-between gap-2 relative z-10">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30">
                                                    LEGENDARY
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-sm text-yellow-100 line-clamp-2">{quest.title}</h3>
                                            <p className="text-xs text-yellow-200/70 line-clamp-4 italic mt-0.5">"{quest.lore || quest.description}"</p>
                                        </div>
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                                            <Trophy className="w-4 h-4 text-yellow-400" />
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1.5 relative z-10">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-yellow-200/70">Distance</span>
                                            <span className="text-yellow-400 font-semibold">
                                                {currentLocation && quest.targetCoordinates ?
                                                    formatDistance(QuestManager.getDistanceToCheckIn(quest, currentLocation) || 0) :
                                                    'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Rewards */}
                                    <div className="flex flex-wrap gap-1.5 pt-1 relative z-10">
                                        {quest.rewards.map((reward, idx) => (
                                            <span
                                                key={idx}
                                                className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-2 py-1 rounded font-medium"
                                            >
                                                +{reward.value} {reward.type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                    {/* Local Landmarks Section */}
                    {nearbyQuests
                        .filter(q => q.type === 'LOCAL')
                        .map((quest) => {
                            const progress = QuestManager.getProgressPercentage(
                                quest,
                                currentLocation,
                                locationHistory
                            );

                            return (
                                <div
                                    key={quest.id}
                                    onClick={() => {
                                        if (quest.targetCoordinates) {
                                            window.dispatchEvent(new CustomEvent('quest-focus', {
                                                detail: {
                                                    lat: quest.targetCoordinates.lat,
                                                    lng: quest.targetCoordinates.lng
                                                }
                                            }));
                                        }
                                    }}
                                    className="bg-cyan-500/10 border border-cyan-500/50 rounded-lg p-3 space-y-3 hover:border-cyan-400 transition-all relative overflow-hidden group cursor-pointer"
                                >
                                    {/* Hover Effect */}
                                    <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    {/* Quest Header */}
                                    <div className="flex items-start justify-between gap-2 relative z-10">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                                    LOCAL
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-sm text-cyan-100 line-clamp-2">{quest.title}</h3>
                                            <p className="text-xs text-cyan-200/70 line-clamp-2 mt-0.5">{quest.lore || quest.description}</p>
                                        </div>
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                                            <MapPin className="w-4 h-4 text-cyan-400" />
                                        </div>
                                    </div>

                                    {/* Distance Info */}
                                    <div className="space-y-1.5 relative z-10">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-cyan-200/70">Distance</span>
                                            <span className="text-cyan-400 font-semibold">
                                                {currentLocation && quest.targetCoordinates ?
                                                    formatDistance(QuestManager.getDistanceToCheckIn(quest, currentLocation) || 0) :
                                                    'Unknown'}
                                            </span>
                                        </div>
                                        {quest.expirationDate && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-cyan-200/70">Expires</span>
                                                <span className="text-cyan-400 font-semibold">
                                                    {Math.max(0, Math.floor((new Date(quest.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Rewards */}
                                    <div className="flex flex-wrap gap-1.5 pt-1 relative z-10">
                                        {quest.rewards.map((reward, idx) => (
                                            <span
                                                key={idx}
                                                className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-1 rounded font-medium"
                                            >
                                                +{reward.value} {reward.type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                    {/* Active Quests - Filtered to only show DAILY/WEEKLY/MOVEMENT */}
                    {nearbyQuests
                        .filter(q => q.type === 'DAILY' || q.type === 'MOVEMENT')
                        .map((quest) => {
                            const progress = QuestManager.getProgressPercentage(
                                quest,
                                currentLocation,
                                locationHistory
                            );

                            return (
                                <div
                                    key={quest.id}
                                    className="bg-secondary/40 border border-border/50 rounded-lg p-3 space-y-3 hover:border-primary/40 transition-all"
                                >
                                    {/* Quest Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm text-foreground truncate">{quest.title}</h3>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{quest.description}</p>
                                        </div>
                                        {quest.type === 'MOVEMENT' && (
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                                <MapPin className="w-4 h-4 text-purple-400" />
                                            </div>
                                        )}

                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="text-primary font-semibold">{Math.round(progress)}%</span>
                                        </div>
                                        <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-yellow-400 transition-all duration-500 ease-out"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>

                                        {/* Distance Info */}
                                        {quest.type === 'MOVEMENT' && quest.targetDistanceMeters && (
                                            <div className="flex justify-between text-xs pt-1">
                                                <span className="text-muted-foreground">
                                                    {formatDistance(
                                                        QuestManager.calculateMovementProgress(quest, locationHistory)
                                                    )}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    / {formatDistance(quest.targetDistanceMeters)}
                                                </span>
                                            </div>
                                        )}


                                    </div>

                                    {/* Rewards */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {quest.rewards.map((reward, idx) => (
                                            <span
                                                key={idx}
                                                className="text-xs bg-primary/10 text-primary border border-primary/30 px-2 py-1 rounded font-medium"
                                            >
                                                +{reward.value} {reward.type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                    {/* Completed Section */}
                    {completedQuests.length > 0 && (
                        <div className="border-t border-border/50 pt-3 mt-3">
                            <div className="flex items-center gap-2 mb-3">
                                <Trophy className="w-4 h-4 text-primary" />
                                <h3 className="font-display text-sm font-bold text-primary">
                                    COMPLETED ({completedQuests.length})
                                </h3>
                            </div>
                            <div className="space-y-1.5">
                                {completedQuests.slice(0, 5).map((quest) => (
                                    <div
                                        key={quest.id}
                                        className="text-xs text-muted-foreground bg-secondary/20 px-2 py-1.5 rounded"
                                    >
                                        ✓ {quest.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
