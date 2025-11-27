'use client';

import { useEffect, useState } from 'react';
import { useQuestStore } from '@/store/questStore';
import { QuestManager } from '@/lib/QuestManager';
import { X, MapPin, Gift } from 'lucide-react';
import { Quest } from '@couch-heroes/shared';

export default function QuestDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const activeQuests = useQuestStore((state) => state.activeQuests);
    const currentLocation = useQuestStore((state) => state.currentLocation);
    const claimReward = useQuestStore((state) => state.claimReward);

    const completeQuest = useQuestStore((state) => state.completeQuest);

    useEffect(() => {
        const handleQuestClick = (e: Event) => {
            const customEvent = e as CustomEvent;
            const questId = customEvent.detail.questId;
            const quest = activeQuests.find(q => q.id === questId);

            if (quest && currentLocation) {
                // Open Dialog regardless of distance
                setSelectedQuest(quest);
                setIsOpen(true);
                setMessage(null);
            }
        };

        window.addEventListener('quest-marker-click', handleQuestClick);
        return () => window.removeEventListener('quest-marker-click', handleQuestClick);
    }, [activeQuests, currentLocation]);

    const handleClaim = async () => {
        if (selectedQuest) {
            // Mark as completed first
            completeQuest(selectedQuest.id);
            // Then claim rewards
            await claimReward(selectedQuest.id);
            setIsOpen(false);
            setSelectedQuest(null);
        }
    };

    if (message) {
        return (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-5">
                <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-full shadow-lg font-bold border border-border">
                    {message}
                </div>
            </div>
        );
    }

    if (!isOpen || !selectedQuest) return null;

    // Calculate distance for render logic
    const distance = (selectedQuest && currentLocation)
        ? QuestManager.getDistanceToCheckIn(selectedQuest, currentLocation)
        : null;

    const isInRange = distance !== null && distance <= 30;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-primary/50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 to-transparent p-4 border-b border-border flex justify-between items-center">
                    <h2 className="font-display text-xl font-bold text-primary tracking-wide">
                        {selectedQuest.title}
                    </h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <MapPin className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-lg font-medium leading-relaxed text-foreground">
                                {isInRange ? selectedQuest.description : '????'}
                            </p>
                            <p className="text-sm text-muted-foreground italic">
                                {isInRange ? "\"This location holds secrets of the Shard...\"" : "\"Move closer to investigate...\""}
                            </p>
                        </div>
                    </div>

                    {/* Rewards */}
                    <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 mt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Gift className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-primary uppercase tracking-wider">Rewards</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedQuest.rewards.map((reward, idx) => (
                                <span
                                    key={idx}
                                    className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-md text-sm font-medium"
                                >
                                    +{reward.value} {reward.type}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-secondary/20 border-t border-border flex justify-end">
                    <button
                        onClick={handleClaim}
                        disabled={!isInRange}
                        className={`px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${isInRange
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 active:scale-95'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                            }`}
                    >
                        {isInRange
                            ? 'Investigate & Claim'
                            : `Not in range (${Math.round(distance || 0)}m)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
