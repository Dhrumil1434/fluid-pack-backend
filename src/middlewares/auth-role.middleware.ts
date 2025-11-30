import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Role } from '../models/role.model';
import { asyncHandler } from '../utils/asyncHandler';

export const AuthRole = (requiredRole: string | string[]) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const token =
        req.cookies?.['accessToken'] ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(401).json({ message: 'Unauthorized: No token found' });
        return;
      }

      const secret = process.env['ACCESS_TOKEN_SECRET']!;
      if (!secret) {
        res.status(500).json({
          message: 'Internal Server Error: Missing ACCESS_TOKEN_SECRET',
        });
        return;
      }

      const decodedToken = jwt.verify(token, secret) as JwtPayload;
      const roleId = decodedToken['role'];

      if (!roleId) {
        res.status(403).json({ message: 'Forbidden: Role not found in token' });
        return;
      }

      const userRole = await Role.findById(roleId);
      if (!userRole) {
        res.status(403).json({ message: 'Forbidden: Role does not exist' });
        return;
      }

      const roleName = userRole.name.toLowerCase(); // assuming Role has `.name`

      const isAllowed = Array.isArray(requiredRole)
        ? requiredRole.map((r) => r.toLowerCase()).includes(roleName)
        : roleName === requiredRole.toLowerCase();

      if (!isAllowed) {
        res.status(403).json({ message: 'Forbidden: Access denied' });
        return;
      }

      next();
    },
  );
};
