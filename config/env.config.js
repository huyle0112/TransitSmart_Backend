require('dotenv').config();

/**
 * Centralized environment configuration
 * All environment variables should be accessed through this module
 */
const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 4000,
        nodeEnv: process.env.NODE_ENV || 'development'
    },

    // Database configuration
    database: {
        url: process.env.DATABASE_URL
    },

    // JWT configuration
    jwt: {
        secret: process.env.JWT_SECRET
    },

    // External APIs
    externalApis: {
        // Python routing service API
        routingService: {
            baseUrl: process.env.ROUTING_API_URL || 'http://127.0.0.1:8000',
            endpoints: {
                findRoute: '/find_route'
            },
            timeout: parseInt(process.env.ROUTING_API_TIMEOUT) || 30000
        }
    },

    // Route finding configuration
    routeFinding: {
        maxTransferOptions: [1, 2, 3],
        nearestStopsCount: 3
    }
};

/**
 * Get full URL for routing service endpoint
 * @param {string} endpoint - The endpoint path (e.g., '/find_route')
 * @returns {string} - Full URL
 */
config.getRoutingApiUrl = function (endpoint = '') {
    return `${this.externalApis.routingService.baseUrl}${endpoint}`;
};

module.exports = config;
