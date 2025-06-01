import { Router } from 'express';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  categoryPaginationQuerySchema,
} from '../modules/admin/categories/validators/category.validator';
import { validateRequest } from '../middlewares/validateRequest';

import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import CategoryController from '../modules/admin/categories/category.controller';

const router = Router();

// Create category - Admin/Manager only
router.post(
  '/',
  verifyJWT,
  AuthRole('admin'),

  validateRequest(createCategorySchema),
  CategoryController.createCategory,
);

// Get all categories with pagination and search - Public access
router.get(
  '/',

  validateRequest(categoryPaginationQuerySchema),
  CategoryController.getAllCategories,
);

// Get active categories (for dropdown/selection) - Public access
router.get('/active', CategoryController.getActiveCategories);

// Validate multiple category IDs - Admin/Manager only

// Check if category exists - Public access
router.get(
  '/exists/:id',

  validateRequest(categoryIdParamSchema),
  CategoryController.checkCategoryExists,
);

// Get category by ID - Public access
router.get(
  '/:id',

  validateRequest(categoryIdParamSchema),
  CategoryController.getCategoryById,
);

// Update category - Admin/Manager only
router.put(
  '/:id',
  verifyJWT,
  AuthRole('admin'),

  validateRequest(categoryIdParamSchema),
  validateRequest(updateCategorySchema),
  CategoryController.updateCategory,
);

// Delete category (soft delete) - Admin only
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),

  validateRequest(categoryIdParamSchema),
  CategoryController.deleteCategory,
);

export default router;
