// routes/permissionConfig.routes.ts
import { Router } from 'express';
import {
  createPermissionConfigSchema,
  updatePermissionConfigSchema,
  checkPermissionSchema,
  actionParamSchema,
  idParamSchema,
  paginationQuerySchema,
  permissionCheckQuerySchema,
  categoryValidationSchema,
} from '../modules/admin/permissionConfig/validators/permissionConfig.validator';
import { validateRequest } from '../middlewares/validateRequest';
// import { validateParams } from '../middlewares/validateParams';
import { validateParams } from '../middlewares/validateRequest';
import { validateQuery } from '../middlewares/validateRequest';
import PermissionConfigController from '../modules/admin/permissionConfig/permissionConfig.controller';

import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';

const router = Router();

// Create permission configuration - Admin only
router.post(
  '/',
  verifyJWT,
  AuthRole('admin'),

  validateRequest(createPermissionConfigSchema),
  PermissionConfigController.createPermissionConfig,
);

// Get all permission configurations with pagination - Admin only
router.get(
  '/',
  verifyJWT,
  AuthRole('admin'),

  validateQuery(paginationQuerySchema),
  PermissionConfigController.getAllPermissionConfigs,
);

// Get permission configurations by action - Admin only
router.get(
  '/action/:action',
  verifyJWT,
  AuthRole('admin'),

  validateParams(actionParamSchema),
  validateQuery(paginationQuerySchema),
  PermissionConfigController.getPermissionConfigsByAction,
);

// Check user permissions (for current user) - All authenticated users
router.get(
  '/my-permissions',
  verifyJWT,

  validateQuery(permissionCheckQuerySchema),
  PermissionConfigController.getMyPermissions,
);

// Check permission for specific action and resource (POST) - All authenticated users
router.post(
  '/check',
  verifyJWT,

  validateRequest(checkPermissionSchema),
  PermissionConfigController.checkPermission,
);

// Check resource permission via GET - All authenticated users
router.get(
  '/check/:action',
  verifyJWT,
  validateParams(actionParamSchema),
  validateQuery(permissionCheckQuerySchema),
  PermissionConfigController.checkResourcePermission,
);

// Validate category IDs utility endpoint - Admin only
router.post(
  '/validate-categories',
  verifyJWT,
  AuthRole('admin'),

  validateRequest(categoryValidationSchema),
  PermissionConfigController.validateCategoryIds,
);

// Get permission configuration by ID - Admin only
router.get(
  '/:id',
  verifyJWT,
  AuthRole('admin'),

  validateParams(idParamSchema),
  PermissionConfigController.getPermissionConfigById,
);

// Update permission configuration - Admin only
router.put(
  '/:id',
  verifyJWT,
  AuthRole('admin'),

  validateParams(idParamSchema),
  validateRequest(updatePermissionConfigSchema),
  PermissionConfigController.updatePermissionConfig,
);

// Toggle permission configuration active status - Admin only
router.patch(
  '/:id/toggle',
  verifyJWT,
  AuthRole('admin'),

  validateParams(idParamSchema),
  PermissionConfigController.togglePermissionConfig,
);

// Delete permission configuration - Admin only
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),

  validateParams(idParamSchema),
  PermissionConfigController.deletePermissionConfig,
);

export default router;
