import { Quest } from '@couch-heroes/shared';
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
        const targetCount = 5;
        const maxTotalAttempts = 200; // Safety break to prevent infinite loops
        let totalAttempts = 0;

        console.log('[QuestSpawner] Generating 5 local quests...');

        while (newQuests.length < targetCount && totalAttempts < maxTotalAttempts) {
            totalAttempts++;

            // 1. Pick a random template
            const template = this.getRandomTemplate();

            // 2. Calculate random position (100m - 2000m)
            const pos = this.calculateRadialPosition(userLat, userLng);
            const lat = pos.lat;
            const lng = pos.lng;

            // Check distance from existing newQuests (min 100m spacing)
            let validPosition = true;
            for (const q of newQuests) {
                if (q.targetCoordinates) {
                    const dist = this.getDistanceFromLatLonInM(lat, lng, q.targetCoordinates.lat, q.targetCoordinates.lng);
                    if (dist < 100) {
                        validPosition = false;
                        break;
                    }
                }
            }

            if (validPosition) {
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
                console.log(`[QuestSpawner] Generated quest ${newQuests.length}/${targetCount} at distance: ${this.getDistanceFromLatLonInM(userLat, userLng, lat, lng).toFixed(0)}m`);
            }
        }

        if (newQuests.length < targetCount) {
            console.warn(`[QuestSpawner] Could only generate ${newQuests.length} quests after ${totalAttempts} attempts.`);
        }

        return newQuests;
    }

    private getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    private deg2rad(deg: number) {
        return deg * (Math.PI / 180);
    }

    /**
     * Calculates a new coordinate based on a random distance and bearing from origin
     * Distance: 100m to 1000m (Uniform Area Distribution)
     * Bearing: 0 to 360 degrees
     */
    private calculateRadialPosition(startLat: number, startLng: number): { lat: number; lng: number } {
        const R = 6371e3; // Earth's radius in meters
        const minRadius = 100;
        const maxRadius = 1000;

        // Uniform Area Distribution:
        // r = sqrt(min^2 + (max^2 - min^2) * random())
        const rSquared = (minRadius * minRadius) + (maxRadius * maxRadius - minRadius * minRadius) * Math.random();
        const distance = Math.sqrt(rSquared);

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
