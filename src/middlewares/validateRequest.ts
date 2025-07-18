import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../utils/ApiError';

/**
 * Common function to handle Joi validation
 */
const handleValidation = (
  schema: Joi.ObjectSchema,
  data: unknown,
  label: string,
  next: NextFunction,
) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return next(
      new ApiError(
        'VALIDATION_ERROR',
        StatusCodes.BAD_REQUEST,
        `INVALID_REQUEST_${label.toUpperCase()}`,
        `Request ${label} validation failed`,
        errors,
      ),
    );
  }

  return value;
};

/**
 * Middleware to validate request body
 */
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validated = handleValidation(schema, req.body, 'body', next);
    if (validated) req.body = validated;
    next();
  };
};

/**
 * Middleware to validate request parameters
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validated = handleValidation(schema, req.params, 'params', next);
    if (validated) req.params = validated;
    next();
  };
};

/**
 * Middleware to validate request query
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validated = handleValidation(schema, req.query, 'query', next);
    if (validated) req.query = validated;
    next();
  };
};
