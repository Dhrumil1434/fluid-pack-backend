import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import MachineApprovalController from '../modules/machine/controllers/machineApproval.controller';

const router = Router();

// Create approval request - All authenticated users
router.post('/', verifyJWT, MachineApprovalController.createApprovalRequest);

// Get user's own approval requests - All authenticated users
router.get(
  '/my-requests',
  verifyJWT,
  MachineApprovalController.getMyApprovalRequests,
);

// Get pending approvals (for approvers) - Admin/Manager only
router.get(
  '/pending',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  MachineApprovalController.getPendingApprovals,
);

// Get all approval requests with pagination and filters - Admin/Manager only
router.get(
  '/',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  MachineApprovalController.getApprovalRequests,
);

// Get approval statistics - Admin/Manager only
router.get(
  '/statistics',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  MachineApprovalController.getApprovalStatistics,
);

// Get approval request by ID - Admin/Manager only
router.get(
  '/:id',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  MachineApprovalController.getApprovalById,
);

// Process approval decision (approve/reject) - Admin/Manager only
router.patch(
  '/:id/process',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  MachineApprovalController.processApprovalDecision,
);

// Cancel approval request (only by requester) - All authenticated users
router.patch(
  '/:id/cancel',
  verifyJWT,
  MachineApprovalController.cancelApprovalRequest,
);

export default router;
