const axios = require('axios');
const { decodePolyline } = require('../utils/polyline.util');

const ORS_API_URL = 'https://api.openrouteservice.org/v2/directions';

/**
 * Get directions from OpenRouteService API
 * @route POST /api/ors/directions
 */
const getDirections = async (req, res) => {
    try {
        const { coordinates, profile } = req.body;

        // Validate input
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'At least 2 coordinates are required'
            });
        }

        // Validate profile
        const validProfiles = ['foot-walking', 'driving-car', 'cycling-regular'];
        const selectedProfile = profile || 'foot-walking';

        if (!validProfiles.includes(selectedProfile)) {
            return res.status(400).json({
                success: false,
                message: `Invalid profile. Must be one of: ${validProfiles.join(', ')}`
            });
        }

        // Check for API key
        const apiKey = process.env.ORS_API_KEY;
        if (!apiKey) {
            console.error('ORS_API_KEY not found in environment variables');
            return res.status(500).json({
                success: false,
                message: 'ORS API key not configured'
            });
        }

        // Call ORS API
        const response = await axios.post(
            `${ORS_API_URL}/${selectedProfile}`,
            {
                coordinates: coordinates,
                instructions: true,
                preference: 'recommended'
            },
            {
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Decode geometry and add to response
        if (response.data.routes && response.data.routes.length > 0) {
            response.data.routes = response.data.routes.map(route => {
                if (route.geometry) {
                    // Decode the polyline
                    const decodedCoordinates = decodePolyline(route.geometry);

                    return {
                        ...route,
                        geometry: route.geometry, // Keep original encoded
                        decoded_geometry: decodedCoordinates // Add decoded version
                    };
                }
                return route;
            });
        }

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('ORS API Error:', error.response?.data || error.message);

        if (error.response) {
            // ORS API returned an error
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data?.error?.message || 'ORS API request failed',
                details: error.response.data
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to get directions from ORS API',
            error: error.message
        });
    }
};

module.exports = {
    getDirections
};
