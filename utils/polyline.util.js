/**
 * Polyline Decoder Utility
 * Decodes ORS/Google encoded polyline format to array of [lat, lng] coordinates
 */

/**
 * Decode an encoded polyline string into an array of lat/lng coordinates
 * @param {string} encoded - Encoded polyline string from ORS API
 * @param {number} precision - Precision (default 5 for ORS)
 * @returns {Array<[number, number]>} Array of [lat, lng] coordinates
 */
function decodePolyline(encoded, precision = 5) {
    if (!encoded || encoded.length === 0) {
        return [];
    }

    const factor = Math.pow(10, precision);
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        // Decode latitude
        let shift = 0;
        let result = 0;
        let byte;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        // Decode longitude
        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}

/**
 * Encode an array of coordinates into a polyline string
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] coordinates
 * @param {number} precision - Precision (default 5)
 * @returns {string} Encoded polyline string
 */
function encodePolyline(coordinates, precision = 5) {
    if (!coordinates || coordinates.length === 0) {
        return '';
    }

    const factor = Math.pow(10, precision);
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const [lat, lng] of coordinates) {
        const encodedLat = encodeValue(Math.round(lat * factor) - prevLat);
        const encodedLng = encodeValue(Math.round(lng * factor) - prevLng);

        encoded += encodedLat + encodedLng;

        prevLat = Math.round(lat * factor);
        prevLng = Math.round(lng * factor);
    }

    return encoded;
}

function encodeValue(value) {
    let encoded = '';
    let val = value < 0 ? ~(value << 1) : (value << 1);

    while (val >= 0x20) {
        encoded += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
        val >>= 5;
    }

    encoded += String.fromCharCode(val + 63);
    return encoded;
}

module.exports = {
    decodePolyline,
    encodePolyline
};
