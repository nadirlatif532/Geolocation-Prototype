import { Quest, QuestType } from '@couch-heroes/shared';
import loreConfig from '../data/lore-config.json';
import { v4 as uuidv4 } from 'uuid';

interface QuestTemplate {
    id: string;
    title: string;
    loreText: string;
    rewardId: string;
}

export class QuestSpawner {
    private templates: QuestTemplate[] = loreConfig;

    /**
     * Spawns 3 local mystery quests around the user
     * @param userLat User's latitude
     * @param userLng User's longitude
     * @returns Array of generated Quests
     */
    spawnLocalQuests(userLat: number, userLng: number): Quest[] {
        const newQuests: Quest[] = [];

        // Generate 3 quests
        for (let i = 0; i < 3; i++) {
            // 1. Pick a random template
            const template = this.getRandomTemplate();

            // 2. Calculate random position (100m - 300m)
            const { lat, lng } = this.calculateRadialPosition(userLat, userLng);

            // 3. Create the quest object
            const quest: Quest = {
                id: uuidv4(),
                type: 'MYSTERY',
                title: template.title,
                description: template.loreText, // Using loreText as description for now
                targetCoordinates: { lat, lng },
                radiusMeters: 30, // Interaction radius
                rewards: [
                    {
                        type: 'ITEM',
                        value: 1,
                        itemId: template.rewardId
                    },
                    {
                        type: 'EXP',
                        value: 50
                    }
                ]
            };

            newQuests.push(quest);
        }

        return newQuests;
    }

    /**
     * Calculates a new coordinate based on a random distance and bearing from origin
     * Distance: 100m to 300m
     * Bearing: 0 to 360 degrees
     */
    private calculateRadialPosition(startLat: number, startLng: number): { lat: number; lng: number } {
        const R = 6371e3; // Earth's radius in meters

        // Random distance between 100m and 300m
        const distance = 100 + Math.random() * 200;

        // Random bearing in radians (0 to 360 degrees)
        const bearing = Math.random() * 2 * Math.PI;

        const lat1 = (startLat * Math.PI) / 180;
        const lon1 = (startLng * Math.PI) / 180;

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(distance / R) +
            Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearing)
        );

        const lon2 = lon1 + Math.atan2(
            Math.sin(bearing) * Math.sin(distance / R) * Math.cos(lat1),
            Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
            lat: (lat2 * 180) / Math.PI,
            lng: (lon2 * 180) / Math.PI
        };
    }

    private getRandomTemplate(): QuestTemplate {
        const index = Math.floor(Math.random() * this.templates.length);
        return this.templates[index];
    }
}

export const questSpawner = new QuestSpawner();
