'use client';

import { useEffect, useState } from 'react';
import { useQuestStore } from '@/store/questStore';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';

export default function QuestCompletionEffect() {
    const lastCompletedQuestId = useQuestStore((state) => state.lastCompletedQuestId);
    const consumeCompletedQuest = useQuestStore((state) => state.consumeCompletedQuest);
    const completedQuests = useQuestStore((state) => state.completedQuests);

    const [showPopup, setShowPopup] = useState(false);
    const [questTitle, setQuestTitle] = useState('');

    useEffect(() => {
        if (lastCompletedQuestId) {
            // Find the quest details
            const quest = completedQuests.find(q => q.id === lastCompletedQuestId);
            if (quest) {
                setQuestTitle(quest.title);
                setShowPopup(true);

                // Trigger Confetti
                const duration = 3000;
                const end = Date.now() + duration;

                // Cyberpunk colors
                const colors = ['#FFD700', '#ff0080', '#00d4ff', '#9d00ff'];

                (function frame() {
                    confetti({
                        particleCount: 5,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: colors
                    });
                    confetti({
                        particleCount: 5,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: colors
                    });

                    if (Date.now() < end) {
                        requestAnimationFrame(frame);
                    }
                }());

                // Hide popup after 3 seconds
                setTimeout(() => {
                    setShowPopup(false);
                }, 3000);
            }

            // Reset the trigger
            consumeCompletedQuest();
        }
    }, [lastCompletedQuestId, completedQuests, consumeCompletedQuest]);

    if (!showPopup) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
            <div className="bg-black/60 backdrop-blur-md border border-primary/50 px-8 py-6 rounded-2xl shadow-[0_0_30px_rgba(255,215,0,0.3)] animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center gap-3">
                <div className="bg-primary/20 p-4 rounded-full mb-2 animate-bounce">
                    <Trophy className="w-10 h-10 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-primary tracking-wider uppercase drop-shadow-md">
                    Quest Complete!
                </h2>
                <p className="text-foreground/90 font-medium text-lg">
                    {questTitle}
                </p>
            </div>
        </div>
    );
}
