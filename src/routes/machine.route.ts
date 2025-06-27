// routes/machine.routes.ts
import { Router } from 'express';
import {
  createMachineSchema,
  updateMachineSchema,
  machineIdParamSchema,
  machinePaginationQuerySchema,
  machineApprovalSchema,
  validateMachineIdsSchema,
} from '../modules/machine/validators/machine.joi.validator';
import { validateRequest } from '../middlewares/validateRequest';
import { validateParams } from '../middlewares/validateRequest';
import { validateQuery } from '../middlewares/validateRequest';
import MachineController from '../modules/machine/machine.controller';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import {
  uploadMachineImages,
  uploadMachineImagesUpdate,
} from '../middlewares/multer.middleware';
import { checkPermission } from '../modules/admin/permissionConfig/middlewares/permissionConfig.validation.middleware';
import { ActionType } from '../models/permissionConfig.model';

const router = Router();

// Create machine with images - Requires authentication
router.post(
  '/',
  verifyJWT,
  checkPermission([ActionType.CREATE_MACHINE]),
  uploadMachineImages.array('images', 5), // Allow up to 5 images with field name 'images'
  validateRequest(createMachineSchema),
  MachineController.createMachine,
);

// Get all machines with pagination - Public access
router.get(
  '/',
  validateQuery(machinePaginationQuerySchema),
  MachineController.getAllMachines,
);

// Get approved machines - Public access
router.get('/approved', MachineController.getApprovedMachines);

// Get machine by ID - Public access
router.get(
  '/:id',
  validateParams(machineIdParamSchema),
  MachineController.getMachineById,
);

// Update machine with optional new images - Requires authentication
router.put(
  '/:id',
  verifyJWT,
  uploadMachineImagesUpdate.array('images', 5), // Allow up to 5 new images
  validateParams(machineIdParamSchema),
  validateRequest(updateMachineSchema),
  MachineController.updateMachine,
);

// Delete machine - Requires authentication and admin role
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  validateParams(machineIdParamSchema),
  MachineController.deleteMachine,
);

// Update machine approval status - Requires admin role
router.patch(
  '/:id/approval',
  verifyJWT,
  AuthRole('admin'),
  validateParams(machineIdParamSchema),
  validateRequest(machineApprovalSchema),
  MachineController.updateMachineApproval,
);

// Get machines by category - Public access
router.get(
  '/category/:id',
  validateParams(machineIdParamSchema),
  MachineController.getMachinesByCategory,
);

// Validate multiple machine IDs - Requires authentication
router.post(
  '/validate-ids',
  verifyJWT,
  validateRequest(validateMachineIdsSchema),
  MachineController.validateMachineIds,
);

export default router;
