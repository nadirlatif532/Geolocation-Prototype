'use client';

import { useQuestStore } from '@/store/questStore';
import { QuestManager } from '@/lib/QuestManager';
import { formatDistance } from '@couch-heroes/shared';
import { MapPin, Target, Trophy } from 'lucide-react';

export default function QuestPanel({ className }: { className?: string }) {
    const nearbyQuests = useQuestStore((state) => state.getNearbyQuests());
    const completedQuests = useQuestStore((state) => state.completedQuests);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const locationHistory = useQuestStore((state) => state.locationHistory);

    if (nearbyQuests.length === 0 && completedQuests.length === 0) {
        return (
            <div className={`absolute top-6 right-6 z-10 w-80 ${className || ''}`}>
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
        <div className={`absolute top-auto bottom-0 left-0 w-full md:top-6 md:right-6 md:bottom-auto md:left-auto md:w-80 z-10 flex flex-col max-h-[50vh] md:max-h-[85vh] ${className || ''}`}>
            <div className="bg-card border-t md:border border-border md:rounded-lg overflow-hidden shadow-2xl flex flex-col max-h-full">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 to-transparent px-4 py-3 border-b border-border flex-shrink-0 flex justify-between items-center">
                    <h2 className="font-display text-xl font-bold text-primary tracking-wide">QUESTS</h2>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {/* Active Quests - Filtered to only show DAILY/WEEKLY */}
                    {nearbyQuests
                        .filter(q => q.type === 'DAILY' || q.type === 'MOVEMENT') // Assuming MOVEMENT is treated as daily for now
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
                                        {quest.type === 'CHECKIN' && (
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                                                <Target className="w-4 h-4 text-pink-400" />
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

                                        {quest.type === 'CHECKIN' && currentLocation && (
                                            <div className="text-xs text-muted-foreground pt-1">
                                                {QuestManager.getDistanceToCheckIn(quest, currentLocation) !== null && (
                                                    <span>
                                                        Distance:{' '}
                                                        {formatDistance(
                                                            QuestManager.getDistanceToCheckIn(quest, currentLocation)!
                                                        )}
                                                    </span>
                                                )}
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
