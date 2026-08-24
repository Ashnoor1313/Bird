import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bird_super_secret_key_2026';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const roleHeader = req.headers['x-user-role'];
    const userIdHeader = req.headers['x-user-id'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token && token !== 'demo_token') {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
          if (user) {
            req.user = user;
            return next();
          }
        } catch (jwtErr) {
          // Fall back to header/default
        }
      }
    }

    // Support role header for demo/switch role mode
    if (roleHeader) {
      req.user = {
        id: userIdHeader || 'usr_demo',
        name: roleHeader === 'OWNER' || roleHeader === 'ADMIN' ? 'Bird Admin Owner' : 'Store Employee / Staff',
        email: roleHeader === 'OWNER' || roleHeader === 'ADMIN' ? 'owner@birdparts.com' : 'staff@birdparts.com',
        role: roleHeader.toUpperCase(),
      };
      return next();
    }

    // Default to owner user from db or default fallback
    const defaultUser = await prisma.user.findFirst({ where: { role: 'OWNER' } });
    req.user = defaultUser || {
      id: 'usr_default',
      name: 'Bird Admin Owner',
      email: 'owner@birdparts.com',
      role: 'OWNER',
    };
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    next();
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const role = (req.user.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Permission Denied: Only Admin / Owner can perform this action or view Profit & Loss financials.',
      code: 'FORBIDDEN_ADMIN_ONLY',
    });
  }

  next();
};
