const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

class JWTUtil {
  static generateAccessToken(payload) {
    try {
      return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'whatsapp-server',
        audience: 'whatsapp-server-users'
      });
    } catch (error) {
      throw new Error(`Error generating access token: ${error.message}`);
    }
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'whatsapp-server',
        audience: 'whatsapp-server-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        throw new Error(`Error verifying access token: ${error.message}`);
      }
    }
  }

  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error(`Error decoding token: ${error.message}`);
    }
  }

  static generateTokenPair(user) {
    try {
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        firstName: user.first_name,
        lastName: user.last_name
      };

      const accessToken = this.generateAccessToken(payload);
      
      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: JWT_EXPIRES_IN
      };
    } catch (error) {
      throw new Error(`Error generating token pair: ${error.message}`);
    }
  }

  static extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  static isTokenExpired(token) {
    try {
      const decoded = this.decodeToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }
}

module.exports = JWTUtil;
