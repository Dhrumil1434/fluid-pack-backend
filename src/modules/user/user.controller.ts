// user.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { StatusCodes } from 'http-status-codes';

import UserService from './services/user.service';

import { ApiError } from '../../utils/ApiError';

import { User } from '../../models/user.model';
import { ApiResponse } from '../../utils/ApiResponse';

export interface AuthenticatedRequest extends Request {
  cookies: { accessToken?: string; refreshToken?: string }; // Define cookies with accessToken
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any;
}
class UserController {
  static registerUser = asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, department, role } = req.body;

    const user = await UserService.register({
      username,
      email,
      password,
      department,
      role,
    });
    res
      .status(StatusCodes.CREATED)
      .json({ message: 'User registered successfully', user });
  });

  static loginUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { email, password } = req.body;

      const tokens = await UserService.login(email, password);
      req.user = tokens;

      const options = { httpOnly: true, secure: true };
      res
        .status(StatusCodes.OK)
        .cookie('accessToken', tokens.accessToken, options)
        .cookie('refreshToken', tokens.refreshToken, options)
        .json({ message: 'Login successful', ...tokens });
    },
  );

  static getAccessToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const accessToken = await UserService.getAccessToken(refreshToken);
    res.status(StatusCodes.OK).json({ accessToken });
  });
  static approveUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      throw new ApiError(
        'APPROVE_USER',
        StatusCodes.NOT_FOUND,
        'USER_NOT_FOUND',
        'User not found.',
      );
    }

    user.isApproved = !user.isApproved;

    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `User's approvity : ${user.isApproved} `,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isApproved: user.isApproved,
      },
    });
  });

  static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    await UserService.forgotPassword(email);
    res
      .status(StatusCodes.OK)
      .json({ message: 'Password reset link sent to email' });
  });

  static logoutUser = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response) => {
      const response = new ApiResponse(
        StatusCodes.OK,
        {},
        'Logout successfully',
      );
      res
        .clearCookie('accessToken', { httpOnly: true, secure: true })
        .clearCookie('refreshToken', { httpOnly: true, secure: true })
        .status(StatusCodes.OK)
        .json(response);
    },
  );

  /**
   * Get user statistics
   * GET /api/user/statistics
   */
  static getUserStatistics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const statistics = await UserService.getUserStatistics();

      const response = new ApiResponse(
        StatusCodes.OK,
        statistics,
        'User statistics retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get all users with pagination
   * GET /api/user
   */
  static getAllUsers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const sortBy = (req.query['sortBy'] as string) || 'createdAt';
      const sortOrder = (req.query['sortOrder'] as string) || 'desc';

      const result = await UserService.getAllUsers(
        page,
        limit,
        sortBy,
        sortOrder,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'Users retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get user by id
   * GET /api/user/:id
   */
  static getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const user = await UserService.getById(id);
    const response = new ApiResponse(
      StatusCodes.OK,
      user,
      'User fetched',
    );
    res.status(response.statusCode).json(response);
  });
}

export default UserController;
