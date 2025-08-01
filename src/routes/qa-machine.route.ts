import { Router } from 'express';
import {
  createQAMachineEntrySchema,
  updateQAMachineEntrySchema,
  qaMachineEntryIdParamSchema,
  machineIdParamSchema,
  userIdParamSchema,
  qaMachinePaginationQuerySchema,
  validateQAMachineEntryIdsSchema,
} from '../modules/machine/validators/qaMachine.validator';
import { validateRequest } from '../middlewares/validateRequest';
import QAMachineController from '../modules/machine/controllers/qaMachine.controller';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import {
  uploadQAMachineFiles,
  uploadQAMachineFilesUpdate,
  handleFileUploadError,
} from '../middlewares/multer.middleware';

const router = Router();

// Apply authentication to all routes
router.use(verifyJWT);

/**
 * QA Machine Entry Routes
 */

// Create a new QA machine entry - Requires QA role
router.post(
  '/',
  AuthRole('qa'),
  uploadQAMachineFiles.array('files', 10), // Allow up to 10 files with field name 'files'
  handleFileUploadError,
  validateRequest(createQAMachineEntrySchema),
  QAMachineController.createQAMachineEntry,
);

// Get all QA machine entries with pagination and filters - Requires QA role
router.get(
  '/',
  AuthRole('qa'),
  validateRequest(qaMachinePaginationQuerySchema),
  QAMachineController.getAllQAMachineEntries,
);

// Get QA machine entry by ID - Requires QA role
router.get(
  '/:id',
  AuthRole('qa'),
  validateRequest(qaMachineEntryIdParamSchema),
  QAMachineController.getQAMachineEntryById,
);

// Update QA machine entry - Requires QA role
router.put(
  '/:id',
  AuthRole('qa'),
  uploadQAMachineFilesUpdate.array('files', 10), // Allow up to 10 new files
  handleFileUploadError,
  validateRequest(qaMachineEntryIdParamSchema),
  validateRequest(updateQAMachineEntrySchema),
  QAMachineController.updateQAMachineEntry,
);

// Delete QA machine entry - Requires QA role
router.delete(
  '/:id',
  AuthRole('qa'),
  validateRequest(qaMachineEntryIdParamSchema),
  QAMachineController.deleteQAMachineEntry,
);

// Get QA entries by machine ID - Requires QA role
router.get(
  '/machine/:machineId',
  AuthRole('qa'),
  validateRequest(machineIdParamSchema),
  QAMachineController.getQAMachineEntriesByMachine,
);

// Get QA entries by user ID - Requires QA role
router.get(
  '/user/:userId',
  AuthRole('qa'),
  validateRequest(userIdParamSchema),
  QAMachineController.getQAMachineEntriesByUser,
);

// Validate multiple QA entry IDs - Requires QA role
router.post(
  '/validate-ids',
  AuthRole('qa'),
  validateRequest(validateQAMachineEntryIdsSchema),
  QAMachineController.validateQAMachineEntryIds,
);

export default router;
