const Redis = require('ioredis');

let redisClient;

function getRedisClient() {
    if (!redisClient) {
        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            console.warn('⚠️  REDIS_URL not configured. Refresh tokens will not persist.');
            return null;
        }

        try {
            redisClient = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            });

            redisClient.on('connect', () => {
                console.log('✅ Redis connected successfully');
            });

            redisClient.on('error', (err) => {
                console.error('❌ Redis connection error:', err.message);
            });

            redisClient.on('ready', () => {
                console.log('✅ Redis ready to use');
            });
        } catch (error) {
            console.error('❌ Failed to initialize Redis:', error.message);
            return null;
        }
    }

    return redisClient;
}

// Helper functions for refresh tokens
const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const USER_TOKENS_PREFIX = 'user_tokens:';

/**
 * Save refresh token to Redis
 * @param {string} userId - User ID
 * @param {string} refreshToken - The refresh token
 * @param {number} expirySeconds - TTL in seconds (default 7 days)
 */
async function saveRefreshToken(userId, refreshToken, expirySeconds = 7 * 24 * 60 * 60) {
    const client = getRedisClient();
    if (!client) return false;

    try {
        const tokenKey = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
        const userTokensKey = `${USER_TOKENS_PREFIX}${userId}`;

        // Store token with user ID and metadata
        await client.setex(
            tokenKey,
            expirySeconds,
            JSON.stringify({
                userId,
                createdAt: new Date().toISOString(),
            })
        );

        // Track all tokens for this user (for multi-device support)
        await client.sadd(userTokensKey, refreshToken);
        await client.expire(userTokensKey, expirySeconds);

        return true;
    } catch (error) {
        console.error('Error saving refresh token to Redis:', error);
        return false;
    }
}

/**
 * Get user ID from refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<string|null>} User ID or null
 */
async function getUserIdFromToken(refreshToken) {
    const client = getRedisClient();
    if (!client) return null;

    try {
        const tokenKey = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
        const data = await client.get(tokenKey);

        if (!data) return null;

        const parsed = JSON.parse(data);
        return parsed.userId;
    } catch (error) {
        console.error('Error getting user ID from token:', error);
        return null;
    }
}

/**
 * Delete refresh token from Redis
 * @param {string} refreshToken - The refresh token
 */
async function deleteRefreshToken(refreshToken) {
    const client = getRedisClient();
    if (!client) return false;

    try {
        const tokenKey = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;

        // Get user ID before deleting
        const data = await client.get(tokenKey);
        if (data) {
            const parsed = JSON.parse(data);
            const userTokensKey = `${USER_TOKENS_PREFIX}${parsed.userId}`;

            // Remove from user's token set
            await client.srem(userTokensKey, refreshToken);
        }

        // Delete the token
        await client.del(tokenKey);
        return true;
    } catch (error) {
        console.error('Error deleting refresh token:', error);
        return false;
    }
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 */
async function revokeAllUserTokens(userId) {
    const client = getRedisClient();
    if (!client) return false;

    try {
        const userTokensKey = `${USER_TOKENS_PREFIX}${userId}`;
        const tokens = await client.smembers(userTokensKey);

        // Delete all tokens
        for (const token of tokens) {
            const tokenKey = `${REFRESH_TOKEN_PREFIX}${token}`;
            await client.del(tokenKey);
        }

        // Delete the set
        await client.del(userTokensKey);
        return true;
    } catch (error) {
        console.error('Error revoking all user tokens:', error);
        return false;
    }
}

module.exports = {
    getRedisClient,
    saveRefreshToken,
    getUserIdFromToken,
    deleteRefreshToken,
    revokeAllUserTokens,
};
