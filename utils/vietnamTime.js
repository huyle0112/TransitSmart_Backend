/**
 * Get current time in Vietnam timezone (GMT+7)
 * @returns {Date} Date object representing current time in Vietnam
 */
function getVietnamTime() {
    // Create date in Vietnam timezone
    const vietnamTimeString = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh'
    });
    return new Date(vietnamTimeString);
}

/**
 * Format time to HH:MM:SS string in Vietnam timezone
 * @param {Date} date - Optional date object (defaults to current Vietnam time)
 * @returns {string} Time string in HH:MM:SS format
 */
function getVietnamTimeString(date = null) {
    const vietnamDate = date || getVietnamTime();
    return vietnamDate.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Get current timestamp in Vietnam timezone
 * @returns {string} ISO string in Vietnam timezone
 */
function getVietnamISOString() {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh'
    });
}

module.exports = {
    getVietnamTime,
    getVietnamTimeString,
    getVietnamISOString
};
