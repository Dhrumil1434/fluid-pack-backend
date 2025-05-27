// user.service.ts
import { User, IUser } from '../../../models/user.model';
import { Role } from '../../../models/role.model';
import { ApiError } from '../../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../user.error.codes';

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
}

export default UserService;
