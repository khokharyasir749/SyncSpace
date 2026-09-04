const jwt = require('jsonwebtoken');

const getSecret = () => process.env.JWT_SECRET || 'syncspace_fallback_jwt_secret_key_2026';

/**
 * Generate a signed JWT token for a given user ID
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} [expiresIn='7d']
 * @returns {string}
 */
const generateToken = (userId, expiresIn = '7d') => {
  return jwt.sign({ id: userId.toString() }, getSecret(), {
    expiresIn,
  });
};

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, getSecret());
};

module.exports = {
  generateToken,
  verifyToken,
};
