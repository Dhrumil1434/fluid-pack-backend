import { Router } from 'express';
import {
  CategoryController,
  SequenceManagementController,
} from '../modules/category/category.controller';
import {
  validateRequest,
  validateQuery,
  validateParams,
} from '../middlewares/validateRequest';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import { validationSchemas } from '../modules/category/validators/category.joi.validator';

const router = Router();

/**
 * Category Routes
 */

// Create category
router.post(
  '/',
  verifyJWT,
  AuthRole(['admin']),
  validateRequest(validationSchemas.createCategory),
  CategoryController.createCategory,
);

// Get all categories
router.get('/', CategoryController.getAllCategories);

// Get category tree
router.get('/tree', CategoryController.getCategoryTree);

/**
 * Sequence Management Routes
 * These routes must come BEFORE the /:id routes to avoid route conflicts
 */

// Create sequence configuration
router.post(
  '/sequence-configs',
  verifyJWT,
  AuthRole(['admin']),
  validateRequest(validationSchemas.createSequenceConfig),
  SequenceManagementController.createSequenceConfig,
);

// Get all sequence configurations
router.get(
  '/sequence-configs',
  SequenceManagementController.getAllSequenceConfigs,
);

// Get sequence configuration by category/subcategory
router.get(
  '/sequence-configs/config',
  validateQuery(validationSchemas.sequenceQuery),
  SequenceManagementController.getSequenceConfigById,
);

// Generate sequence number
// IMPORTANT: This must come BEFORE /sequence-configs/:id routes to ensure proper matching
router.post(
  '/sequence-configs/generate',
  verifyJWT,
  validateRequest(validationSchemas.sequenceGeneration),
  SequenceManagementController.generateSequence,
);

// Get sequence configuration by ID
router.get(
  '/sequence-configs/:id',
  verifyJWT,
  AuthRole(['admin']),
  validateParams(validationSchemas.sequenceConfigId),
  SequenceManagementController.getSequenceConfigById,
);

// Update sequence configuration
router.put(
  '/sequence-configs/:id',
  verifyJWT,
  AuthRole(['admin']),
  validateParams(validationSchemas.sequenceConfigId),
  validateRequest(validationSchemas.updateSequenceConfig),
  SequenceManagementController.updateSequenceConfig,
);

// Delete sequence configuration
router.delete(
  '/sequence-configs/:id',
  verifyJWT,
  AuthRole(['admin']),
  validateParams(validationSchemas.sequenceConfigId),
  SequenceManagementController.deleteSequenceConfig,
);

// Reset sequence number
// IMPORTANT: This must come AFTER /sequence-configs/generate to avoid conflicts
router.post(
  '/sequence-configs/:id/reset',
  verifyJWT,
  AuthRole(['admin']),
  validateParams(validationSchemas.sequenceConfigId),
  validateRequest(validationSchemas.sequenceReset),
  SequenceManagementController.resetSequence,
);

// Get category by ID (must come AFTER specific routes)
router.get(
  '/:id',
  verifyJWT,
  validateParams(validationSchemas.categoryId),
  CategoryController.getCategoryById,
);

// Get category hierarchy path
router.get(
  '/:id/path',
  verifyJWT,
  validateParams(validationSchemas.categoryId),
  CategoryController.getCategoryPath,
);

// Update category
router.put(
  '/:id',
  verifyJWT,
  AuthRole(['admin']),
  validateParams(validationSchemas.categoryId),
  validateRequest(validationSchemas.updateCategory),
  CategoryController.updateCategory,
);

// Delete category (soft delete)
router.delete(
  '/:id',
  verifyJWT,
  AuthRole(['admin']),
  validateParams(validationSchemas.categoryId),
  CategoryController.deleteCategory,
);

export default router;
