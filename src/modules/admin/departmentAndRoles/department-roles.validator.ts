import Joi from 'joi';
export const createRoleSchema = Joi.object({
  name: Joi.string().trim().lowercase().min(2).max(30).required().messages({
    'string.base': 'Role name must be a string',
    'string.empty': 'Role name is required',
    'string.min': 'Role name should be at least 2 characters',
    'any.required': 'Role name is required',
  }),

  description: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Description should not exceed 100 characters',
  }),
});

export const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().lowercase().min(2).max(30).required().messages({
    'string.base': 'Department name must be a string',
    'string.empty': 'Department name is required',
    'string.min': 'Department name should be at least 2 characters',
    'any.required': 'Department name is required',
  }),

  description: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Description should not exceed 100 characters',
  }),
});
export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().lowercase().min(2).max(30).optional().messages({
    'string.base': 'Role name must be a string',
    'string.min': 'Role name should be at least 2 characters',
  }),
  description: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Description should not exceed 100 characters',
  }),
});
export const updateDepartmentSchema = Joi.object({
  name: Joi.string().trim().lowercase().min(2).max(30).optional().messages({
    'string.base': 'Department name must be a string',
    'string.min': 'Department name should be at least 2 characters',
  }),
  description: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Description should not exceed 100 characters',
  }),
});
