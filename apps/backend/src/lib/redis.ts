import Redis from 'ioredis';

// Redis client for location stream
export const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redis.on('connect', () => {
    console.log('[Redis] Connected to Redis');
});

redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err);
});

// Stream key for location updates
export const LOCATION_STREAM_KEY = 'geo:stream';
