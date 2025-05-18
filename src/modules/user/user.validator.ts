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
