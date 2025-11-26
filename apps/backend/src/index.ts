import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { redis, LOCATION_STREAM_KEY } from './lib/redis.js';
import { questSpawner } from './services/QuestSpawner.js';
import { PrismaClient } from '@prisma/client';

const app = new Hono();
const prisma = new PrismaClient();

// CORS middleware
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * POST /location/update
 * Ingests location updates into Redis Stream (Write-Behind pattern)
 */
app.post('/location/update', async (c) => {
    try {
        const body = await c.req.json();
        const { userId, lat, lng, speed, timestamp } = body;

        // Validation
        if (!userId || lat === undefined || lng === undefined) {
            return c.json({ error: 'Missing required fields' }, 400);
        }

        // Write to Redis Stream instead of directly to Postgres
        await redis.xadd(
            LOCATION_STREAM_KEY,
            '*', // Auto-generate ID
            'userId', userId,
            'lat', lat.toString(),
            'lng', lng.toString(),
            'speed', (speed || 0).toString(),
            'timestamp', (timestamp || Date.now()).toString()
        );

        return c.json({
            success: true,
            message: 'Location queued for processing'
        });
    } catch (error) {
        console.error('[Location Update] Error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

/**
 * POST /quests/scan
 * Scans for local mystery quests based on user location
 */
app.post('/quests/scan', async (c) => {
    try {
        const body = await c.req.json();
        const { lat, lng, userId } = body;

        if (!lat || !lng || !userId) {
            return c.json({ error: 'Missing lat, lng, or userId' }, 400);
        }

        console.log(`[API] Scanning for quests for user ${userId} at ${lat}, ${lng}`);

        // Generate local quests
        const newQuests = questSpawner.spawnLocalQuests(lat, lng);

        // Persist to database (using Prisma)
        // Note: In a real app, we'd check if quests already exist in this area to avoid spam
        await prisma.$transaction(
            newQuests.map((quest) =>
                prisma.quest.create({
                    data: {
                        id: quest.id,
                        type: quest.type,
                        title: quest.title,
                        description: quest.description,
                        targetLat: quest.targetCoordinates?.lat,
                        targetLng: quest.targetCoordinates?.lng,
                        radiusMeters: quest.radiusMeters,
                        rewards: JSON.stringify(quest.rewards),
                        // Link to user as "active" immediately for this MVP
                        UserQuest: {
                            create: {
                                userId: userId,
                                status: 'ACTIVE',
                                progress: 0
                            }
                        }
                    }
                })
            )
        );

        return c.json({ quests: newQuests });
    } catch (error) {
        console.error('Failed to scan for quests:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

/**
 * GET /quests
 * List all available quests
 */
app.get('/quests', async (c) => {
    return c.json({
        quests: [],
        message: 'Quest endpoints coming soon'
    });
});

const port = parseInt(process.env.PORT || '3001');

console.log(`[Hono Backend] Starting server on port ${port}...`);

serve({
    fetch: app.fetch,
    port,
});

console.log(`[Hono Backend] Server running at http://localhost:${port}`);
