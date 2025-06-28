import Joi from 'joi';
import mongoose from 'mongoose';

export const registerUserSchema = Joi.object({
  username: Joi.string().trim().lowercase().min(3).max(30).required(),

  email: Joi.string().email().trim().lowercase().required(),

  password: Joi.string()
    .min(6)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .message(
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    )
    .required(),

  department: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .required(),

  role: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .required(),

  isApproved: Joi.boolean().optional(),

  createdBy: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .optional(),
});

export const loginUserSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),

  password: Joi.string().min(6).max(128).required(),
});

export const updateUserSchema = Joi.object({
  username: Joi.string().trim().lowercase().min(3).max(30).optional(),
  email: Joi.string().email().trim().lowercase().optional(),
  department: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .optional(),
  role: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .optional(),
  isApproved: Joi.boolean().optional(),
});

export const userIdParamSchema = Joi.object({
  id: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .required(),
});

export const userPaginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().optional(),
  role: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .optional(),
  department: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'ObjectId Validation')
    .optional(),
  isApproved: Joi.boolean().optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).max(128).required(),
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .message(
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    )
    .required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .message(
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit.',
    )
    .required(),
});
