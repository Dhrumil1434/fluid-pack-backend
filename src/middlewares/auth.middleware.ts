import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';


// Extend Express Request to include cookies
interface AuthenticatedRequest extends Request {
  user?: any;
  cookies: { accessToken?: string };
}

export const verifyJWT = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Get token from cookies or headers
    const token =
      req.cookies?.accessToken ||
      req.get('Authorization')?.replace('Bearer ', '');

        if (!token) throw new ApiError(401, 'NO_TOKEN', 'Access token missing');


    const secret: string = process.env['ACCESS_TOKEN_SECRET']!; 
    if (!secret) {
      return res.status(500).json({
        message: 'Internal Server Error: Missing ACCESS_TOKEN_SECRET',
      });
    }

    
      // Verify token and cast it to JwtPayload
      const decodedToken = jwt.verify(token, secret) as JwtPayload;

      if (!decodedToken['_id']) {
        return res
          .status(401)
          .json({ message: 'Unauthorized: Invalid token structure' });
      }

      // Find user by ID from token payload
      const user = await User.findById(decodedToken['_id'])
      .populate('role')
      .select('-password ');


          if (!user) throw new ApiError(401, 'INVALID_TOKEN', 'User not found');


      req.user = user;

      next(); // Proceed to next middleware
    },
);
