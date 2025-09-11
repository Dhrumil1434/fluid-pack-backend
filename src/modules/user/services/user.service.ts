// user.service.ts
import { User, IUser } from '../../../models/user.model';
import { Role } from '../../../models/role.model';
import { ApiError } from '../../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../user.error.codes';
import { Types } from 'mongoose';

interface RegisterData {
  username: string;
  email: string;
  password?: string;
  department: string;
  role: string;
}

class UserService {
  static async register(data: RegisterData): Promise<Partial<IUser>> {
    const { username, email, password, department, role } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(
        ERROR_MESSAGES.USER.ACTION.register,
        StatusCodes.CONFLICT,
        ERROR_MESSAGES.USER.ALREADY_EXISTS.code,
        ERROR_MESSAGES.USER.ALREADY_EXISTS.message,
      );
    }

    // Check if role exists
    const roleDoc = await Role.findById(role);
    if (!roleDoc) {
      throw new ApiError(
        ERROR_MESSAGES.USER.ACTION.register,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.USER.ROLE_NOT_FOUND.code,
        ERROR_MESSAGES.USER.ROLE_NOT_FOUND.message,
      );
    }

    // Set approval flag if role is 'admin'
    let isApproved = false;

    // ✅ If the role is admin, check if there is already an approved admin
    if (roleDoc.name?.toLowerCase() === 'admin') {
      const existingAdmin = await User.findOne({ role, isApproved: true });
      isApproved = !existingAdmin; // Approve if no admin exists
    }

    // Create and save new user
    const newUser = new User({
      username,
      email,
      password,
      department,
      role,
      isApproved,
    });

    await newUser.save();

    // Strip password and return
    const userWithoutPassword = newUser.toObject();
    return userWithoutPassword;
  }

  static async login(email: string, password: string) {
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.isPasswordCorrect(password))) {
      throw new ApiError(
        'LOGIN_USER',
        StatusCodes.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }

    if (!user.isApproved) {
      throw new ApiError(
        'LOGIN_USER',
        StatusCodes.FORBIDDEN,
        'USER_NOT_APPROVED',
        'User is not approved yet',
      );
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    return {
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  static async getAccessToken(refreshToken: string): Promise<string> {
    const secret = process.env['REFRESH_TOKEN_SECRET'];
    if (!secret) throw new Error('REFRESH_TOKEN_SECRET is not set');

    try {
      const payload = jwt.verify(refreshToken, secret) as { _id: string };
      const user = await User.findById(payload._id);

      if (!user) {
        throw new ApiError(
          'TOKEN',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'User not found',
        );
      }

      return user.generateAccessToken();
    } catch {
      throw new ApiError(
        'TOKEN',
        StatusCodes.UNAUTHORIZED,
        'INVALID_TOKEN',
        'Invalid refresh token',
      );
    }
  }

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(
        'FORGOT_PASSWORD',
        StatusCodes.NOT_FOUND,
        'EMAIL_NOT_FOUND',
        'Email not registered',
      );
    }

    // Stub: you can integrate nodemailer/sendgrid/mailgun etc.
    console.log(`Send reset link to ${email} (simulate sending email here)`);
  }

  /**
   * Get single user by id
   */
  static async getById(id: string): Promise<{
    _id: string;
    username: string;
    email: string;
    isApproved: boolean;
    role: { _id: string; name: string } | null;
    department: { _id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const user = await User.findById(id)
      .select('-password -refreshToken')
      .populate('role', 'name')
      .populate('department', 'name');

    if (!user) {
      throw new ApiError(
        'GET_USER_BY_ID',
        StatusCodes.NOT_FOUND,
        'USER_NOT_FOUND',
        'User not found',
      );
    }

    return user as unknown as {
      _id: string;
      username: string;
      email: string;
      isApproved: boolean;
      role: { _id: string; name: string } | null;
      department: { _id: string; name: string } | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }

  /**
   * Get user statistics
   */
  static async getUserStatistics(): Promise<{
    totalUsers: number;
    approvedUsers: number;
    pendingUsers: number;
    usersByRole: Array<{ _id: string; count: number }>;
    usersByDepartment: Array<{ _id: string; count: number }>;
    recentUsers: number;
  }> {
    try {
      const totalUsers = await User.countDocuments();
      const approvedUsers = await User.countDocuments({ isApproved: true });
      const pendingUsers = await User.countDocuments({ isApproved: false });

      // Get users by role
      const usersByRole = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get users by department
      const usersByDepartment = await User.aggregate([
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsers = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      return {
        totalUsers,
        approvedUsers,
        pendingUsers,
        usersByRole,
        usersByDepartment,
        recentUsers,
      };
    } catch {
      throw new ApiError(
        'GET_USER_STATISTICS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_USER_STATISTICS_ERROR',
        'Failed to retrieve user statistics',
      );
    }
  }

  /**
   * Get all users with pagination and sorting
   */
  static async getAllUsers(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc',
  ): Promise<{
    users: Array<{
      _id: string;
      username: string;
      email: string;
      isApproved: boolean;
      role: { name: string };
      department: { name: string };
      createdAt: Date;
      updatedAt: Date;
    }>;
    total: number;
    pages: number;
    currentPage: number;
    limit: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      // Build sort object
      const sort: Record<string, 1 | -1> = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [users, total] = await Promise.all([
        User.find({ deletedAt: null })
          .select('-password -refreshToken') // Exclude sensitive fields
          .populate('role', 'name')
          .populate('department', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        User.countDocuments({ deletedAt: null }),
      ]);

      return {
        users: users as unknown as Array<{
          _id: string;
          username: string;
          email: string;
          isApproved: boolean;
          role: { name: string };
          department: { name: string };
          createdAt: Date;
          updatedAt: Date;
        }>,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      };
    } catch {
      throw new ApiError(
        'GET_ALL_USERS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_ALL_USERS_ERROR',
        'Failed to retrieve users',
      );
    }
  }

  /**
   * Update user by id
   * @param id - User ID
   * @param updateData - Data to update
   * @returns Updated user
   */
  static async updateUser(
    id: string,
    updateData: {
      username?: string;
      email?: string;
      role?: string;
      department?: string;
      isApproved?: boolean;
    },
  ) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new ApiError(
          'UPDATE_USER',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'User not found',
        );
      }

      // Update fields if provided
      if (updateData.username) user.username = updateData.username;
      if (updateData.email) user.email = updateData.email;
      if (updateData.role) user.role = new Types.ObjectId(updateData.role);
      if (updateData.department)
        user.department = new Types.ObjectId(updateData.department);
      if (typeof updateData.isApproved === 'boolean')
        user.isApproved = updateData.isApproved;

      await user.save();

      // Populate role and department
      await user.populate('role department');

      return user;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'UPDATE_USER',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_USER_ERROR',
        'Failed to update user',
      );
    }
  }

  /**
   * Delete user by id
   * @param id - User ID
   */
  static async deleteUser(id: string) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new ApiError(
          'DELETE_USER',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'User not found',
        );
      }

      await User.findByIdAndDelete(id);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'DELETE_USER',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'DELETE_USER_ERROR',
        'Failed to delete user',
      );
    }
  }
}

export default UserService;
