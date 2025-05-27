import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { User } from '../../models/user.model';
import { Role } from '../../models/role.model';
import { Department } from '../../models/department.model';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import jwt from 'jsonwebtoken';

class AuthController {

    static registerUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { username, email, password, role, department } = req.body;

        if (!username || !email || !password || !role || !department) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'All fields are required');
        }

        const roleDoc = await Role.findById(role);
        if (!roleDoc) throw new ApiError(404, 'ROLE_NOT_FOUND', 'Invalid role');

        const deptDoc = await Department.findById(department);
        if (!deptDoc) throw new ApiError(404, 'DEPARTMENT_NOT_FOUND', 'Invalid department');

        const existingUser = await User.findOne({ email });
        if (existingUser) throw new ApiError(409, 'DUPLICATE_EMAIL', 'Email already in use');

        const newUser = await User.create({ username, email, password, role, department });
        const accessToken = newUser.generateAccessToken();
        const refreshToken = newUser.generateRefreshToken();

        // Set cookies
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env['NODE_ENV'] === 'production',
            maxAge: 15 * 60 * 1000, // 15 mins
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env['NODE_ENV'] === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res
            .status(201)
            .json(new ApiResponse(201, { user: newUser, accessToken, refreshToken }, 'User registered successfully'));
    });


    static loginUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password required');
        }

        const user = await User.findOne({ email }).select('+password').populate('role');
        if (!user || !(await user.isPasswordCorrect(password))) {
            throw new ApiError(401, 'AUTH_FAILED', 'Invalid credentials');
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env['NODE_ENV'] === 'production',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env['NODE_ENV'] === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json(new ApiResponse(200, { user, accessToken, refreshToken }, 'Login successful'));
    });


    static logoutUser = asyncHandler(async (req: Request, res: Response) => {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        return res.status(200).json(new ApiResponse(200, {}, 'Logged out successfully'));
    });

     static refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.['refreshToken'] || req.get('Authorization')?.replace('Bearer ', '');

    if (!token) throw new ApiError(401, 'NO_REFRESH_TOKEN', 'Refresh token missing');

    const secret = process.env['REFRESH_TOKEN_SECRET']!;
    let decoded;

    try {
      decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    } catch (error) {
      throw new ApiError(403, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded['_id']).populate('role');
    if (!user) throw new ApiError(401, 'USER_NOT_FOUND', 'User not found');

    const newAccessToken = user.generateAccessToken();

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json(new ApiResponse(200, { accessToken: newAccessToken }, 'Access token refreshed'));
  });

}

export default AuthController;
