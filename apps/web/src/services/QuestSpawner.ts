import { Quest } from '@couch-heroes/shared';
import loreConfig from '../data/lore-config.json';
import { v4 as uuidv4 } from 'uuid';

interface QuestTemplate {
    id: string;
    title: string;
    loreText: string;
    rewardId: string;
}

interface OverpassElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat: number;
    lon: number;
    tags?: {
        name?: string;
        [key: string]: string | undefined;
    };
    geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
    elements: OverpassElement[];
}

export class QuestSpawner {
    private templates: QuestTemplate[] = loreConfig;

    /**
     * Spawns 5 mystery quests around the user, preferring landmarks or roads
     * @param userLat User's latitude
     * @param userLng User's longitude
     * @param excludeLandmarkIds IDs of existing landmark quests to avoid
     * @returns Array of generated Quests
     */
    async spawnLocalQuests(userLat: number, userLng: number, excludeLandmarkIds: string[] = []): Promise<Quest[]> {
        const newQuests: Quest[] = [];
        const targetCount = 5;

        console.log('[QuestSpawner] Generating 5 mystery quests...');

        // Try to fetch landmarks first
        const landmarks = await this.queryLandmarksForMystery(userLat, userLng, excludeLandmarkIds);
        console.log(`[QuestSpawner] Found ${landmarks.length} available landmarks`);

        // Fetch roads as fallback
        const roads = landmarks.length < 3 ? await this.queryRoadsForMystery(userLat, userLng) : [];
        if (roads.length > 0) {
            console.log(`[QuestSpawner] Found ${roads.length} roads as fallback`);
        }

        for (let i = 0; i < targetCount; i++) {
            const template = this.getRandomTemplate();
            let lat: number, lng: number;
            let spawnMethod = 'random';

            if (landmarks.length > i) {
                // Spawn near landmark (within 30m)
                const landmark = landmarks[i];
                const offset = (Math.random() - 0.5) * 0.0006; // ~30m
                lat = landmark.lat + offset;
                lng = landmark.lon + offset;
                spawnMethod = `landmark:${landmark.tags?.name || 'unnamed'}`;
            } else if (roads.length > 0) {
                // Spawn near random road point (within 10m)
                const road = roads[Math.floor(Math.random() * roads.length)];
                const point = road.geometry?.[Math.floor(Math.random() * (road.geometry.length || 1))] || { lat: userLat, lon: userLng };
                const offset = (Math.random() - 0.5) * 0.0002; // ~10m
                lat = point.lat + offset;
                lng = point.lon + offset;
                spawnMethod = 'road';
            } else {
                // Fallback to random position
                const pos = this.calculateRadialPosition(userLat, userLng);
                lat = pos.lat;
                lng = pos.lng;
                spawnMethod = 'random';
            }

            // Ensure minimum spacing from existing quests (100m)
            let validPosition = true;
            for (const q of newQuests) {
                if (q.targetCoordinates) {
                    const dist = this.getDistanceFromLatLonInM(lat, lng, q.targetCoordinates.lat, q.targetCoordinates.lng);
                    if (dist < 100) {
                        // If too close, use fallback random position
                        const pos = this.calculateRadialPosition(userLat, userLng);
                        lat = pos.lat;
                        lng = pos.lng;
                        spawnMethod = 'random-spacing';
                        break;
                    }
                }
            }

            const quest: Quest = {
                id: uuidv4(),
                type: 'MYSTERY',
                title: template.title,
                description: template.loreText,
                targetCoordinates: { lat, lng },
                radiusMeters: 30,
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
            const distanceFromPlayer = this.getDistanceFromLatLonInM(userLat, userLng, lat, lng);
            console.log(`[QuestSpawner] Quest ${i + 1}/${targetCount}: ${spawnMethod} at ${distanceFromPlayer.toFixed(0)}m`);
        }

        return newQuests;
    }

    /**
     * Query Overpass API for landmarks (excluding those already in use)
     */
    private async queryLandmarksForMystery(lat: number, lng: number, excludeIds: string[]): Promise<OverpassElement[]> {
        const query = `
            [out:json][timeout:25];
            (
                node["historic"~"monument|memorial|ruins|castle|archaeological_site|wayside_cross|wayside_shrine"](around:2000,${lat},${lng});
                node["tourism"~"attraction|artwork|viewpoint|museum|gallery|picnic_site"](around:2000,${lat},${lng});
                node["leisure"~"park|playground|garden|sports_centre|pitch|stadium"](around:2000,${lat},${lng});
                node["amenity"~"cafe|restaurant|bar|place_of_worship|library|theatre|cinema|fountain"](around:2000,${lat},${lng});
                node["shop"~"mall|supermarket|convenience|department_store"](around:2000,${lat},${lng});
                node["natural"~"peak|cave_entrance|spring|waterfall"](around:2000,${lat},${lng});
            );
            out body center;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!response.ok) {
                console.warn('[QuestSpawner] Overpass API error:', response.statusText);
                return [];
            }

            const data: OverpassResponse = await response.json();

            // Filter out landmarks already used by other quests
            return data.elements.filter((e) => {
                if (!e.lat || !e.lon) return false;

                const milestoneId = `milestone-${e.id}`;
                const localId = `local-${e.id}`;

                return !excludeIds.includes(milestoneId) && !excludeIds.includes(localId);
            });
        } catch (error) {
            console.warn('[QuestSpawner] Failed to fetch landmarks:', error);
            return [];
        }
    }

    /**
     * Query Overpass API for roads as fallback
     */
    private async queryRoadsForMystery(lat: number, lng: number): Promise<OverpassElement[]> {
        const query = `
            [out:json][timeout:25];
            (
                way["highway"~"primary|secondary|tertiary|residential|pedestrian|footway|path"](around:1000,${lat},${lng});
            );
            out geom;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!response.ok) {
                console.warn('[QuestSpawner] Overpass API error (roads):', response.statusText);
                return [];
            }

            const data: OverpassResponse = await response.json();
            return data.elements.filter((e) => e.geometry && e.geometry.length > 0);
        } catch (error) {
            console.warn('[QuestSpawner] Failed to fetch roads:', error);
            return [];
        }
    }

    private getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; // Radius of the earth in meters
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
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
