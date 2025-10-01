import { Router } from 'express';
import {
  createQAMachineEntrySchema,
  updateQAMachineEntrySchema,
  qaMachineEntryIdParamSchema,
  machineIdParamSchema,
  userIdParamSchema,
  validateQAMachineEntryIdsSchema,
} from '../modules/machine/validators/qcMachine.validator';
import {
  validateRequest,
  parseJsonFields,
} from '../middlewares/validateRequest';
import QAMachineController from '../modules/machine/controllers/qcMachine.controller';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import { checkPermission } from '../modules/admin/permissionConfig/middlewares/permissionConfig.validation.middleware';
import { ActionType } from '../models/permissionConfig.model';
import {
  uploadQAMachineFiles,
  uploadQAMachineFilesUpdate,
  handleFileUploadError,
} from '../middlewares/multer.middleware';

const router = Router();

/**
 * QC Machine Entry Routes
 */

// Get QC statistics - Public access for testing
router.get('/statistics', QAMachineController.getQAStatistics);

// Get all QC machine entries - allow admin, manager1, qc
router.get('/', QAMachineController.getAllQAMachineEntries);

// Apply authentication to all other routes
router.use(verifyJWT);

// Create a new QC machine entry - allow admin, manager1, qc
router.post(
  '/',
  AuthRole(['admin', 'manager1', 'qc']),
  uploadQAMachineFiles.array('files', 10), // Allow up to 10 files with field name 'files'
  handleFileUploadError,
  // Permission: create QC entry
  checkPermission([ActionType.CREATE_QC_ENTRY]),
  // Parse JSON string fields from multipart/form-data
  parseJsonFields(['metadata']),
  validateRequest(createQAMachineEntrySchema),
  QAMachineController.createQAMachineEntry,
);

// Get QC machine entry by ID - allow admin, manager1, qc
router.get(
  '/:id',
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_ENTRY]),
  validateRequest(qaMachineEntryIdParamSchema),
  QAMachineController.getQAMachineEntryById,
);

// Update QC machine entry - restrict to admin only
router.put(
  '/:id',
  AuthRole('admin'),
  uploadQAMachineFilesUpdate.array('files', 10), // Allow up to 10 new files
  handleFileUploadError,
  checkPermission([ActionType.EDIT_QC_ENTRY]),
  validateRequest(qaMachineEntryIdParamSchema),
  validateRequest(updateQAMachineEntrySchema),
  QAMachineController.updateQAMachineEntry,
);

// Delete QC machine entry - restrict to admin only
router.delete(
  '/:id',
  AuthRole('admin'),
  checkPermission([ActionType.DELETE_QC_ENTRY]),
  validateRequest(qaMachineEntryIdParamSchema),
  QAMachineController.deleteQAMachineEntry,
);

// Get QC entries by machine ID - allow admin, manager1, qc
router.get(
  '/machine/:machineId',
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_ENTRY]),
  validateRequest(machineIdParamSchema),
  QAMachineController.getQAMachineEntriesByMachine,
);

// Get QC entries by user ID - allow admin, manager1, qc
router.get(
  '/user/:userId',
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_ENTRY]),
  validateRequest(userIdParamSchema),
  QAMachineController.getQAMachineEntriesByUser,
);

// Validate multiple QC entry IDs - allow admin, manager1, qc
router.post(
  '/validate-ids',
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_ENTRY]),
  validateRequest(validateQAMachineEntryIdsSchema),
  QAMachineController.validateQAMachineEntryIds,
);

export default router;
