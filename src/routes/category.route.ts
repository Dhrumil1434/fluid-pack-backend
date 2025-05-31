import { Router } from 'express';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  categoryPaginationQuerySchema,
} from '../modules/admin/categories/validators/category.validator';
import { validateRequest } from '../middlewares/validateRequest';
import { validateParams } from '../middlewares/validateRequest';
import { upload } from '../middlewares/multer.middleware';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import CategoryController from '../modules/admin/categories/category.controller';

const router = Router();

// Create category - Admin/Manager only
router.post(
  '/',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  validateRequest(createCategorySchema),
  CategoryController.createCategory,
);

// Get all categories with pagination and search - Public access
router.get(
  '/',
  upload.any(),
  validateRequest(categoryPaginationQuerySchema),
  CategoryController.getAllCategories,
);

// Get active categories (for dropdown/selection) - Public access
router.get('/active', upload.any(), CategoryController.getActiveCategories);

// Validate multiple category IDs - Admin/Manager only

// Check if category exists - Public access
router.get(
  '/exists/:id',
  upload.any(),
  // validateRequest(categoryIdParamSchema, 'params'),
  validateParams(categoryIdParamSchema),
  CategoryController.checkCategoryExists,
);

// Get category by ID - Public access
router.get(
  '/:id',
  upload.any(),
  // validateRequest(categoryIdParamSchema, 'params'),
  validateParams(categoryIdParamSchema),
  CategoryController.getCategoryById,
);

// Update category - Admin/Manager only
router.put(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  // validateRequest(categoryIdParamSchema, 'params'),
  validateParams(categoryIdParamSchema),
  validateRequest(updateCategorySchema),
  CategoryController.updateCategory,
);

// Delete category (soft delete) - Admin only
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  // validateRequest(categoryIdParamSchema, 'params'),
  validateParams(categoryIdParamSchema),
  CategoryController.deleteCategory,
);

export default router;
