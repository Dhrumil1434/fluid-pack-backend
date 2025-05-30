import { Router } from 'express';
import {
  createPermissionConfigSchema,
  updatePermissionConfigSchema,
  checkPermissionSchema,
  actionParamSchema,
  idParamSchema,
} from '../modules/admin/permissionConfig/validators/permissionConfig.validator';
import { validateRequest } from '../middlewares/validateRequest';
import PermissionConfigController from '../modules/admin/permissionConfig/permissionConfig.controller';
import { upload } from '../middlewares/multer.middleware';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';

const router = Router();

// Create permission configuration - Admin only
router.post(
  '/',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  validateRequest(createPermissionConfigSchema),
  PermissionConfigController.createPermissionConfig,
);

// Get all permission configurations with pagination - Admin/Manager
router.get(
  '/',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  PermissionConfigController.getAllPermissionConfigs,
);

// Get permission configurations by action - Admin/Manager
router.get(
  '/action/:action',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  validateRequest(actionParamSchema),
  PermissionConfigController.getPermissionConfigsByAction,
);

// Check user permissions (for current user)
router.get(
  '/my-permissions',
  verifyJWT,
  upload.any(),
  PermissionConfigController.getMyPermissions,
);

// Check permission for specific action and resource
router.post(
  '/check',
  verifyJWT,
  upload.any(),
  validateRequest(checkPermissionSchema),
  PermissionConfigController.checkPermission,
);

// Check resource permission via GET (alternative endpoint)
router.get(
  '/check/:action',
  verifyJWT,
  upload.any(),
  validateRequest(actionParamSchema),
  PermissionConfigController.checkResourcePermission,
);

// Get permission configuration by ID - Admin/Manager
router.get(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  validateRequest(idParamSchema),
  PermissionConfigController.getPermissionConfigById,
);

// Update permission configuration - Admin only
router.put(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  validateRequest(updatePermissionConfigSchema),
  PermissionConfigController.updatePermissionConfig,
);

// Toggle permission configuration active status - Admin only
router.patch(
  '/:id/toggle',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  PermissionConfigController.togglePermissionConfig,
);

// Delete permission configuration - Admin only
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  PermissionConfigController.deletePermissionConfig,
);

export default router;
