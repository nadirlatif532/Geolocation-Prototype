import { Quest, QuestType } from '@couch-heroes/shared';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_KEY_PREFIX = 'landmark_cache_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface OverpassElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat: number;
    lon: number;
    tags?: {
        name?: string;
        'name:en'?: string;
        historic?: string;
        tourism?: string;
        amenity?: string;
        description?: string;
        inscription?: string;
        'memorial:text'?: string;
        wikipedia?: string;
        [key: string]: string | undefined;
    };
}

interface OverpassResponse {
    elements: OverpassElement[];
}

export class LandmarkService {
    private static instance: LandmarkService;

    private constructor() { }

    public static getInstance(): LandmarkService {
        if (!LandmarkService.instance) {
            LandmarkService.instance = new LandmarkService();
        }
        return LandmarkService.instance;
    }

    /**
     * Fetch nearby landmarks using Overpass API with prioritization
     */
    public async fetchNearbyLandmarks(lat: number, lng: number, radiusMeters: number = 5000): Promise<Quest[]> {
        const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(3)}_${lng.toFixed(3)}_${radiusMeters}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('[LandmarkService] Returning cached landmarks');
            return cached;
        }

        try {
            // Priority 1: Historic Monuments & Memorials within 5km
            let elements = await this.queryOverpass(lat, lng, Math.min(radiusMeters, 5000), `
                node["historic"~"monument|memorial|ruins|castle"](around:${Math.min(radiusMeters, 5000)},${lat},${lng});
                way["historic"~"monument|memorial|ruins|castle"](around:${Math.min(radiusMeters, 5000)},${lat},${lng});
            `);

            // Fallback: If few results, expand to general tourism/landmarks
            if (elements.length < 5) {
                console.log('[LandmarkService] Few monuments found, expanding search...');
                const generalElements = await this.queryOverpass(lat, lng, radiusMeters, `
                    node["tourism"~"attraction|artwork|viewpoint|museum"](around:${radiusMeters},${lat},${lng});
                    node["leisure"~"park|playground"](around:${radiusMeters},${lat},${lng});
                    node["amenity"~"place_of_worship|cafe|restaurant"](around:${radiusMeters},${lat},${lng});
                    node["shop"="mall"](around:${radiusMeters},${lat},${lng});
                    node["building"="commercial"](around:${radiusMeters},${lat},${lng});
                `);
                // Merge and deduplicate by ID
                const existingIds = new Set(elements.map(e => e.id));
                generalElements.forEach(e => {
                    if (!existingIds.has(e.id)) {
                        elements.push(e);
                    }
                });
            }

            const quests = elements
                .filter(e => e.tags?.name) // Must have a name
                .map(e => this.mapElementToQuest(e, lat, lng));

            this.saveToCache(cacheKey, quests);
            return quests;

        } catch (error) {
            console.error('[LandmarkService] Error fetching landmarks:', error);
            return [];
        }
    }

    private async queryOverpass(lat: number, lng: number, radius: number, queryBody: string): Promise<OverpassElement[]> {
        const query = `
            [out:json][timeout:25];
            (
                ${queryBody}
            );
            out body center;
            >;
            out skel qt;
        `;

        const response = await fetch(OVERPASS_API_URL, {
            method: 'POST',
            body: query,
        });

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.statusText}`);
        }

        const data: OverpassResponse = await response.json();
        return data.elements.filter(e => e.lat && e.lon); // Ensure coordinates exist (center for ways)
    }

    private mapElementToQuest(element: OverpassElement, playerLat: number, playerLng: number): Quest {
        const title = element.tags?.['name:en'] || element.tags?.name || 'Unknown Landmark';
        const description = this.generateFlavorText(element);

        // Calculate distance for reward multiplier
        const distance = this.calculateDistance(playerLat, playerLng, element.lat, element.lon);
        const rewardMultiplier = this.calculateRewardMultiplier(distance);

        return {
            id: `milestone-${element.id}`,
            type: 'MILESTONE',
            title: title,
            description: `Visit ${title}`,
            lore: description,
            refreshType: 'WEEKLY',
            expirationDate: this.getNextWeeklyReset(),
            targetCoordinates: {
                lat: element.lat,
                lng: element.lon
            },
            radiusMeters: 50,
            rewards: [
                {
                    type: 'EXP',
                    value: Math.floor(500 * rewardMultiplier),
                },
                {
                    type: 'ITEM',
                    value: 'Ancient Relic', // Placeholder "Cool" reward
                    itemId: 'relic_common'
                }
            ]
        };
    }

    private generateFlavorText(element: OverpassElement): string {
        const tags = element.tags || {};
        if (tags.description) return tags.description;
        if (tags.inscription) return `Inscribed: "${tags.inscription}"`;
        if (tags['memorial:text']) return `Memorial: "${tags['memorial:text']}"`;
        if (tags.wikipedia) return `A historic site documented in Wikipedia: ${tags.wikipedia}`;

        // Generic fallback templates
        const type = tags.historic || tags.tourism || tags.amenity || 'landmark';
        const templates = [
            `A significant ${type} that has stood the test of time.`,
            `Locals tell stories about this ${type}.`,
            `A perfect spot to reflect on history at this ${type}.`,
            `This ${type} is a key part of the city's heritage.`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    private calculateRewardMultiplier(distanceMeters: number): number {
        // 1.0x at 0km, 1.5x at 5km, 2.0x at 10km
        // Linear scale: 1 + (distance / 10000)
        return 1 + Math.min(distanceMeters / 10000, 1.0);
    }

    private getNextWeeklyReset(): Date {
        const now = new Date();
        const nextReset = new Date(now);
        nextReset.setDate(now.getDate() + (7 - now.getDay()) % 7); // Next Sunday
        nextReset.setHours(23, 59, 59, 999);
        return nextReset;
    }

    // --- Simple Local Storage Cache ---

    private getFromCache(key: string): Quest[] | null {
        if (typeof window === 'undefined') return null;
        const item = localStorage.getItem(key);
        if (!item) return null;

        try {
            const { timestamp, data } = JSON.parse(item);
            if (Date.now() - timestamp > CACHE_DURATION_MS) {
                localStorage.removeItem(key);
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    private saveToCache(key: string, data: Quest[]) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data
        }));
    }
}

export const landmarkService = LandmarkService.getInstance();
