import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { redis, LOCATION_STREAM_KEY } from './lib/redis.js';
import { validateSpeed, detectTeleportation } from '@couch-heroes/shared';

const app = new Hono();

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

        // TODO: Add anti-cheat validation here if needed
        // For now, just ingest to stream

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
 * GET /quests
 * List all available quests
 */
app.get('/quests', async (c) => {
    // TODO: Implement with Prisma
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
