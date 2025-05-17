import { Request, Response, NextFunction } from 'express';

import jwt, { JwtPayload } from 'jsonwebtoken';

import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';

// Extend Express Request to include cookies
interface AuthenticatedRequest extends Request {
  cookies: { accessToken?: string }; // Define cookies with accessToken
  user?: mongoose.Document;
}

export const verifyJWT = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Get token from cookies or headers
    const token =
      req.cookies?.accessToken ||
      req.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Unauthorized: No token provided' });
    }

    const secret: string = process.env['ACCESS_TOKEN_SECRET']!;
    if (!secret) {
      return res.status(500).json({
        message: 'Internal Server Error: Missing ACCESS_TOKEN_SECRET',
      });
    }

    try {
      // Verify token and cast it to JwtPayload
      const decodedToken = jwt.verify(token, secret) as JwtPayload;

      if (!decodedToken['_id']) {
        return res
          .status(401)
          .json({ message: 'Unauthorized: Invalid token structure' });
      }

      // Find user by ID from token payload
      const user = await User.findById(decodedToken['_id']).select(
        '-password -refreshToken',
      );
      if (!user) {
        return res
          .status(401)
          .json({ message: 'Unauthorized: Invalid Access Token' });
      }

      req.user = user;

      next(); // Proceed to next middleware
    } catch {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  },
);
