/**
 * Redis Stream Worker
 * Reads location updates from Redis Stream and batch-writes to Postgres
 */

import { PrismaClient } from '@prisma/client';
import { redis, LOCATION_STREAM_KEY } from './lib/redis.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 1000; // Poll every 1 second
const CONSUMER_GROUP = 'location-processors';
const CONSUMER_NAME = `worker-${process.pid}`;

interface LocationStreamEntry {
    userId: string;
    lat: string;
    lng: string;
    speed: string;
    timestamp: string;
}

async function initializeConsumerGroup() {
    try {
        // Create consumer group if it doesn't exist
        await redis.xgroup(
            'CREATE',
            LOCATION_STREAM_KEY,
            CONSUMER_GROUP,
            '0',
            'MKSTREAM'
        );
        console.log(`[Worker] Consumer group "${CONSUMER_GROUP}" created`);
    } catch (error: any) {
        // BUSYGROUP error means group already exists
        if (error.message && error.message.includes('BUSYGROUP')) {
            console.log(`[Worker] Consumer group "${CONSUMER_GROUP}" already exists`);
        } else {
            throw error;
        }
    }
}

async function processBatch() {
    try {
        // Read from stream using consumer group
        const results = await redis.xreadgroup(
            'GROUP',
            CONSUMER_GROUP,
            CONSUMER_NAME,
            'COUNT',
            BATCH_SIZE,
            'BLOCK',
            POLL_INTERVAL_MS,
            'STREAMS',
            LOCATION_STREAM_KEY,
            '>' // Only read new messages
        );

        if (!results || results.length === 0) {
            return; // No new messages
        }

        const [streamKey, entries] = results[0] as [string, [string, string[]][]];

        if (entries.length === 0) {
            return;
        }

        console.log(`[Worker] Processing batch of ${entries.length} location updates`);

        // Parse entries
        const locationData = entries.map(([id, fields]) => {
            const data: any = {};
            for (let i = 0; i < fields.length; i += 2) {
                data[fields[i]] = fields[i + 1];
            }

            return {
                id,
                userId: data.userId,
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lng),
                speed: parseFloat(data.speed),
                timestamp: BigInt(data.timestamp),
            };
        });

        // Batch write to Postgres
        await prisma.locationHistory.createMany({
            data: locationData.map((loc) => ({
                userId: loc.userId,
                lat: loc.lat,
                lng: loc.lng,
                speed: loc.speed,
                timestamp: loc.timestamp,
            })),
            skipDuplicates: true,
        });

        console.log(`[Worker] Wrote ${locationData.length} records to Postgres`);

        // Acknowledge messages
        const messageIds = entries.map(([id]) => id);
        await redis.xack(LOCATION_STREAM_KEY, CONSUMER_GROUP, ...messageIds);

        console.log(`[Worker] Acknowledged ${messageIds.length} messages`);
    } catch (error) {
        console.error('[Worker] Error processing batch:', error);
    }
}

async function main() {
    console.log('[Worker] Starting Redis Stream worker...');

    await initializeConsumerGroup();

    console.log(`[Worker] Listening to stream "${LOCATION_STREAM_KEY}"`);
    console.log(`[Worker] Batch size: ${BATCH_SIZE}, Poll interval: ${POLL_INTERVAL_MS}ms`);

    // Continuous processing loop
    while (true) {
        await processBatch();
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...');
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
});

// Start worker
main().catch((error) => {
    console.error('[Worker] Fatal error:', error);
    process.exit(1);
});
