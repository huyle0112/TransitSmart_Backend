/**
 * In-memory data store for user authentication
 * This is a simple mock store. In production, use a real database.
 */

const users = new Map();
const routes = new Map();

/**
 * Add a new user
 */
function addUser(user) {
  users.set(user.id, user);
  return user;
}

/**
 * Get user by ID
 */
function getUserById(userId) {
  return users.get(userId);
}

/**
 * Get user by email
 */
function getUserByEmail(email) {
  return Array.from(users.values()).find(u => u.email === email);
}

/**
 * Update user
 */
function updateUser(userId, updates) {
  const user = users.get(userId);
  if (!user) return null;

  const updated = { ...user, ...updates };
  users.set(userId, updated);
  return updated;
}

/**
 * Save a route
 */
function saveRoute(routeId, routeData) {
  routes.set(routeId, routeData);
  return routeData;
}

/**
 * Get a route by ID
 */
function getRoute(routeId) {
  return routes.get(routeId);
}

/**
 * Get all routes for a user
 */
function getUserRoutes(userId) {
  return Array.from(routes.values()).filter(r => r.userId === userId);
}

module.exports = {
  addUser,
  getUserById,
  getUserByEmail,
  updateUser,
  saveRoute,
  getRoute,
  getUserRoutes,
};

