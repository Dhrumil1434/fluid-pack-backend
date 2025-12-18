// routes/soApproval.route.ts
import { Router } from 'express';
import SOApprovalController from '../modules/so/soApproval.controller';
import { verifyJWT } from '../middlewares/auth.middleware';

const router = Router();

// Create SO approval request - Requires authentication
router.post('/', verifyJWT, SOApprovalController.createApprovalRequest);

// Get all SO approval requests - Requires authentication
router.get('/', verifyJWT, SOApprovalController.getApprovalRequests);

// Get pending SO approvals for current user's role - Requires authentication
router.get('/pending', verifyJWT, SOApprovalController.getPendingApprovals);

// Get user's own SO approval requests - Requires authentication
router.get(
  '/my-requests',
  verifyJWT,
  SOApprovalController.getMyApprovalRequests,
);

// Get SO approval request by ID - Requires authentication
router.get('/:id', verifyJWT, SOApprovalController.getApprovalById);

// Process SO approval decision (approve/reject) - Requires authentication and admin role
router.patch(
  '/:id/process',
  verifyJWT,
  SOApprovalController.processApprovalDecision,
);

// Cancel SO approval request - Requires authentication
router.patch(
  '/:id/cancel',
  verifyJWT,
  SOApprovalController.cancelApprovalRequest,
);

export default router;
