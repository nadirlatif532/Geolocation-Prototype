'use client';

import { useQuestStore } from '@/store/questStore';
import { QuestManager } from '@/lib/QuestManager';
import { formatDistance } from '@couch-heroes/shared';
import { MapPin, Target, Trophy } from 'lucide-react';

export default function QuestPanel() {
    // FOG OF WAR: Only show quests within 2km
    const nearbyQuests = useQuestStore((state) => state.getNearbyQuests());
    const completedQuests = useQuestStore((state) => state.completedQuests);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const locationHistory = useQuestStore((state) => state.locationHistory);

    if (nearbyQuests.length === 0 && completedQuests.length === 0) {
        return (
            <div className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 max-w-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-cyber-blue" />
                    <h2 className="font-display text-lg font-bold">Quests</h2>
                </div>
                <p className="text-sm text-muted-foreground">No nearby quests. Explore to discover more!</p>
            </div>
        );
    }

    return (
        <div className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-cyber-blue" />
                <h2 className="font-display text-lg font-bold">Nearby Quests</h2>
            </div>

            {/* Active Quests (within 2km) */}
            <div className="space-y-3 mb-4">
                {nearbyQuests.map((quest) => {
                    const progress = QuestManager.getProgressPercentage(
                        quest,
                        currentLocation,
                        locationHistory
                    );

                    return (
                        <div
                            key={quest.id}
                            className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm">{quest.title}</h3>
                                    <p className="text-xs text-muted-foreground">{quest.description}</p>
                                </div>
                                {quest.type === 'MOVEMENT' && (
                                    <MapPin className="w-4 h-4 text-cyber-purple flex-shrink-0" />
                                )}
                                {quest.type === 'CHECKIN' && (
                                    <Target className="w-4 h-4 text-cyber-pink flex-shrink-0" />
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-1">
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-cyber-blue to-cyber-purple transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                {/* Quest-specific info */}
                                {quest.type === 'MOVEMENT' && quest.targetDistanceMeters && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            {formatDistance(
                                                QuestManager.calculateMovementProgress(quest, locationHistory)
                                            )}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatDistance(quest.targetDistanceMeters)}
                                        </span>
                                    </div>
                                )}

                                {quest.type === 'CHECKIN' && currentLocation && (
                                    <div className="text-xs text-muted-foreground">
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
                            <div className="flex flex-wrap gap-1">
                                {quest.rewards.map((reward, idx) => (
                                    <span
                                        key={idx}
                                        className="text-xs bg-accent/50 text-accent-foreground px-2 py-0.5 rounded"
                                    >
                                        +{reward.value} {reward.type}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Completed Quests */}
            {completedQuests.length > 0 && (
                <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-cyber-green" />
                        <h3 className="font-display text-sm font-bold">Completed ({completedQuests.length})</h3>
                    </div>
                    <div className="space-y-2">
                        {completedQuests.slice(0, 3).map((quest) => (
                            <div key={quest.id} className="text-xs text-muted-foreground">
                                ✓ {quest.title}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
