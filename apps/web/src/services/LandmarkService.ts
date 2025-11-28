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
            // Single comprehensive query combining heritage and historic monuments
            // Prioritizes heritage sites with wikidata/wikipedia, then expands to all heritage and historic sites
            console.log('[LandmarkService] Querying heritage and historic landmarks...');
            let elements = await this.queryOverpass(lat, lng, radiusMeters, `
                node["heritage"]["wikidata"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                way["heritage"]["wikidata"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                node["heritage"]["wikipedia"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                way["heritage"]["wikipedia"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                node["heritage"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                way["heritage"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                node["historic"~"monument|memorial|ruins|castle|archaeological_site"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                way["historic"~"monument|memorial|ruins|castle|archaeological_site"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
            `);

            console.log(`[LandmarkService] Found ${elements.length} heritage/historic landmarks`);

            // Fallback: Only if very few results, expand to general tourism/landmarks
            if (elements.length < 3) {
                console.log('[LandmarkService] Few results, expanding to general landmarks...');
                const generalElements = await this.queryOverpass(lat, lng, radiusMeters, `
                    node["tourism"~"attraction|artwork|viewpoint|museum"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                    node["leisure"~"park|playground"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                    node["amenity"~"place_of_worship|cafe|restaurant"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
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
                console.log(`[LandmarkService] Total after expansion: ${elements.length}`);
            }

            const quests = elements
                .filter(e => {
                    // Strict filtering to exclude graveyards/cemeteries
                    const name = (e.tags?.name || '').toLowerCase();
                    const amenity = (e.tags?.amenity || '').toLowerCase();
                    const landuse = (e.tags?.landuse || '').toLowerCase();
                    const historic = (e.tags?.historic || '').toLowerCase();

                    const forbiddenTerms = ['grave', 'cemetery', 'tomb', 'funeral', 'crematorium', 'mausoleum', 'necropolis'];

                    if (forbiddenTerms.some(term => name.includes(term))) return false;
                    if (forbiddenTerms.some(term => amenity.includes(term))) return false;
                    if (forbiddenTerms.some(term => landuse.includes(term))) return false;
                    if (forbiddenTerms.some(term => historic.includes(term))) return false;

                    return !!e.tags?.name; // Must have a name
                })
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
            expirationDate: this.get7DayExpiration(), // Changed from getNextWeeklyReset()
            targetCoordinates: {
                lat: element.lat,
                lng: element.lon
            },
            radiusMeters: 100,
            rewards: [
                {
                    type: 'EXP',
                    value: Math.ceil((500 * rewardMultiplier) / 10) * 10, // Round up to nearest 10
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

    /**
     * Fetch nearby local landmarks (cafes, parks, shops) for LOCAL quests
     * Max distance: configurable, default 2KM
     */
    public async fetchLocalLandmarks(lat: number, lng: number, radiusMeters: number = 2000): Promise<Quest[]> {
        const cacheKey = `${CACHE_KEY_PREFIX}local_${lat.toFixed(3)}_${lng.toFixed(3)}_${radiusMeters}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('[LandmarkService] Returning cached local landmarks');
            return cached;
        }

        try {
            // Query for local POIs: cafes, restaurants, parks, playgrounds, shops (Excluding Graveyards)
            const elements = await this.queryOverpass(lat, lng, radiusMeters, `
                node["amenity"~"cafe|restaurant|bar|fast_food"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                node["leisure"~"park|playground|garden|sports_centre"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                node["shop"~"convenience|supermarket|bakery|books|clothes"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
                node["tourism"~"artwork|viewpoint"]["amenity"!~"grave_yard|crematorium|funeral_hall"]["landuse"!="cemetery"](around:${radiusMeters},${lat},${lng});
            `);

            const quests = elements
                .filter(e => {
                    // Strict filtering to exclude graveyards/cemeteries
                    const name = (e.tags?.name || '').toLowerCase();
                    const amenity = (e.tags?.amenity || '').toLowerCase();
                    const landuse = (e.tags?.landuse || '').toLowerCase();
                    const historic = (e.tags?.historic || '').toLowerCase();

                    const forbiddenTerms = ['grave', 'cemetery', 'tomb', 'funeral', 'crematorium', 'mausoleum', 'necropolis'];

                    if (forbiddenTerms.some(term => name.includes(term))) return false;
                    if (forbiddenTerms.some(term => amenity.includes(term))) return false;
                    if (forbiddenTerms.some(term => landuse.includes(term))) return false;
                    if (forbiddenTerms.some(term => historic.includes(term))) return false;

                    return !!e.tags?.name; // Must have a name
                })
                .map(e => this.mapElementToLocalQuest(e, lat, lng));

            this.saveToCache(cacheKey, quests);
            return quests;

        } catch (error) {
            console.error('[LandmarkService] Error fetching local landmarks:', error);
            return [];
        }
    }

    private calculateRewardMultiplier(distanceMeters: number): number {
        // 1.0x at 0km, 1.5x at 5km, 2.0x at 10km
        // Linear scale: 1 + (distance / 10000)
        return 1 + Math.min(distanceMeters / 10000, 1.0);
    }

    private mapElementToLocalQuest(element: OverpassElement, playerLat: number, playerLng: number): Quest {
        const title = element.tags?.['name:en'] || element.tags?.name || 'Unknown Place';
        const description = this.generateLocalFlavorText(element);

        // Calculate distance for reward multiplier
        const distance = this.calculateDistance(playerLat, playerLng, element.lat, element.lon);
        const rewardMultiplier = this.calculateRewardMultiplier(distance);

        return {
            id: `local-${element.id}`,
            type: 'LOCAL',
            title: title,
            description: `Visit ${title}`,
            lore: description,
            refreshType: 'NONE', // Local quests are managed by the quest store
            expirationDate: this.get3DayExpiration(),
            targetCoordinates: {
                lat: element.lat,
                lng: element.lon
            },
            radiusMeters: 50,
            rewards: [
                {
                    type: 'EXP',
                    value: Math.ceil((100 * rewardMultiplier) / 10) * 10, // Round up to nearest 10
                },
                {
                    type: 'CURRENCY',
                    value: Math.ceil((25 * rewardMultiplier) / 10) * 10, // Round up to nearest 10
                }
            ]
        };
    }

    private generateLocalFlavorText(element: OverpassElement): string {
        const tags = element.tags || {};
        const type = tags.amenity || tags.leisure || tags.shop || tags.tourism || 'place';

        const templates: Record<string, string[]> = {
            'cafe': ['A cozy spot for a quick break.', 'Popular among locals for coffee.', 'Great place to relax and recharge.'],
            'restaurant': ['Known for its local cuisine.', 'A favorite dining spot.', 'Offers a taste of local flavors.'],
            'park': ['A peaceful green space.', 'Perfect for a relaxing walk.', 'Local favorite for outdoor activities.'],
            'playground': ['A fun spot for community gatherings.', 'Popular with families.', 'Kids love this place!'],
            'shop': ['A convenient local store.', 'Part of the neighborhood charm.', 'A go-to spot for residents.'],
            'default': ['A local point of interest.', 'Part of the community fabric.', 'Worth checking out while exploring.']
        };

        const typeTemplates = templates[type] || templates['default'];
        return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
    }

    private get3DayExpiration(): Date {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        date.setHours(23, 59, 59, 999);
        return date;
    }

    private get7DayExpiration(): Date {
        const now = new Date();
        const expiry = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
        return expiry;
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
