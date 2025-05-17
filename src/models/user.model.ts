import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

/**
 * IUser interface defines the structure of a User document
 */
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  department: mongoose.Types.ObjectId;
  role: mongoose.Types.ObjectId;
  isApproved: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  // Custom instance methods
  isPasswordCorrect(password: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
}

/**
 * User Schema
 */
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    methods: {
      // Compare plain password with hashed password
      async isPasswordCorrect(password: string): Promise<boolean> {
        // `this` refers to the document instance
        return bcrypt.compare(password, this.password);
      },

      // Generate JWT access token
      // Generate JWT access token
      generateAccessToken: function (): string {
        const payload = {
          _id: this._id,
          email: this.email,
          username: this.username,
        };

        const secret = process.env['ACCESS_TOKEN_SECRET'];
        const expiry = process.env[
          'ACCESS_TOKEN_EXPIRY'
        ] as jwt.SignOptions['expiresIn'];

        if (!secret) {
          throw new Error('ACCESS_TOKEN_SECRET not defined');
        }

        if (!expiry) {
          throw new Error('ACCESS_TOKEN_EXPIRY not defined');
        }

        // Explicitly cast expiry to string
        const options: SignOptions = {
          expiresIn: expiry,
        };

        return jwt.sign(payload, secret, options);
      },
      // Generate JWT refresh token
      generateRefreshToken(): string {
        const payload = {
          _id: this._id,
        };

        const secret = process.env['REFRESH_TOKEN_SECRET'];
        const expiry = process.env[
          'REFRESH_TOKEN_EXPIRY'
        ] as jwt.SignOptions['expiresIn'];

        if (!secret || !expiry) {
          throw new Error('REFRESH_TOKEN_SECRET or EXPIRY not defined');
        }

        return jwt.sign(payload, secret, { expiresIn: expiry });
      },
    },
  },
);

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
  next();
});

/**
 * Export the User model
 */
export const User = mongoose.model<IUser>('User', userSchema);
