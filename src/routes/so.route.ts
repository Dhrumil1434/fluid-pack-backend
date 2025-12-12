// routes/so.route.ts
import { Router } from 'express';
import {
  createSOSchema,
  updateSOSchema,
} from '../modules/so/validators/so.joi.validator';
import {
  validateRequest,
  parseJsonFields,
} from '../middlewares/validateRequest';
import SOController from '../modules/so/so.controller';
import { verifyJWT } from '../middlewares/auth.middleware';
import {
  uploadMachineDocuments,
  handleFileUploadError,
} from '../middlewares/multer.middleware';
import { checkPermission } from '../modules/admin/permissionConfig/middlewares/permissionConfig.validation.middleware';
import { ActionType } from '../models/permissionConfig.model';

const router = Router();

// Create SO with documents - Requires authentication
router.post(
  '/',
  verifyJWT,
  checkPermission([ActionType.CREATE_SO]),
  uploadMachineDocuments.fields([{ name: 'documents', maxCount: 10 }]),
  handleFileUploadError,
  parseJsonFields([]),
  validateRequest(createSOSchema),
  SOController.createSO,
);

// Get all SOs with pagination and filters - Requires authentication
router.get(
  '/',
  verifyJWT,
  checkPermission([ActionType.VIEW_SO]),
  SOController.getAllSOs,
);

// Get active SOs only (for dropdown) - Requires authentication
router.get('/active', verifyJWT, SOController.getActiveSOs);

// Get SO by ID - Requires authentication
router.get(
  '/:id',
  verifyJWT,
  checkPermission([ActionType.VIEW_SO]),
  SOController.getSOById,
);

// Update SO with optional new documents - Requires authentication
router.put(
  '/:id',
  verifyJWT,
  checkPermission([ActionType.EDIT_SO]),
  uploadMachineDocuments.fields([{ name: 'documents', maxCount: 10 }]),
  handleFileUploadError,
  parseJsonFields(['removedDocuments']),
  validateRequest(updateSOSchema),
  SOController.updateSO,
);

// Soft delete SO - Requires authentication and permission
router.delete(
  '/:id',
  verifyJWT,
  checkPermission([ActionType.DELETE_SO]),
  SOController.deleteSO,
);

// Activate SO - Requires authentication and permission
router.patch(
  '/:id/activate',
  verifyJWT,
  checkPermission([ActionType.UPDATE_SO]),
  SOController.activateSO,
);

// Deactivate SO - Requires authentication and permission
router.patch(
  '/:id/deactivate',
  verifyJWT,
  checkPermission([ActionType.UPDATE_SO]),
  SOController.deactivateSO,
);

export default router;
