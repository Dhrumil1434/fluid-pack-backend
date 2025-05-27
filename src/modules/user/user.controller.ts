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

    user.isApproved = true;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'User approved successfully',
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
    async (req: AuthenticatedRequest, res: Response) => {
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
}

export default UserController;
