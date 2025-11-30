/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import { checkPermission } from '../modules/admin/permissionConfig/middlewares/permissionConfig.validation.middleware';
import { ActionType } from '../models/permissionConfig.model';
import QCApprovalController from '../modules/machine/controllers/qcApproval.controller';
import { validateRequest } from '../middlewares/validateRequest';
import { upload } from '../middlewares/multer.middleware';
import {
  createQCApprovalSchema,
  updateQCApprovalSchema,
  qcApprovalIdParamSchema,
  qcApprovalActionSchema,
} from '../modules/machine/validators/qcApproval.validator';

const router = Router();

/**
 * QC Approval Routes
 */

// Get QC approval statistics - allow admin, manager1, qc
router.get(
  '/statistics',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  QCApprovalController.getQCApprovalStatistics,
);

// Get all QC approvals - allow admin, manager1, qc
router.get(
  '/',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  QCApprovalController.getAllQCApprovals,
);

// Get QC approval by ID - allow admin, manager1, qc
router.get(
  '/:id',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  validateRequest(qcApprovalIdParamSchema),
  QCApprovalController.getQCApprovalById,
);

// Create new QC approval - allow admin, manager1, qc
router.post(
  '/',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.CREATE_QC_APPROVAL]),
  validateRequest(createQCApprovalSchema),
  QCApprovalController.createQCApproval,
);

// Update QC approval - allow admin, manager1, qc (for PENDING/REJECTED records)
router.put(
  '/:id',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.EDIT_QC_APPROVAL]),
  validateRequest(updateQCApprovalSchema),
  QCApprovalController.updateQCApproval,
);

// Delete QC approval - restrict to admin only
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  checkPermission([ActionType.DELETE_QC_APPROVAL]),
  validateRequest(qcApprovalIdParamSchema),
  QCApprovalController.deleteQCApproval,
);

// Approve/Reject QC approval - allow admin, manager1, qc (approvers)
router.post(
  '/action',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.APPROVE_QC_APPROVAL]),
  validateRequest(qcApprovalActionSchema),
  QCApprovalController.processQCApprovalAction,
);

// List approvals assigned to the current approver (by status) - allow admin, manager1, qc
router.get(
  '/assigned/my',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  async (req, res, next) => {
    try {
      const { status = 'PENDING', page = 1, limit = 20 } = req.query as any;
      const pageNum = parseInt(String(page), 10);
      const limitNum = parseInt(String(limit), 10);

      const userId = (req as any).user?._id || (req as any).user?.id;
      const filter: any = { approvers: { $in: [userId] } };
      if (status) filter.status = status;

      const skip = (pageNum - 1) * limitNum;
      const approvals = await (
        await import('../models/qcApproval.model')
      ).QCApproval.find(filter)
        .populate('machineId', 'name category_id images')
        .populate('requestedBy', 'username name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
      const total = await (
        await import('../models/qcApproval.model')
      ).QCApproval.countDocuments(filter);
      const pages = Math.ceil(total / limitNum);
      res.status(200).json({
        statusCode: 200,
        data: {
          approvals,
          total,
          pages,
          currentPage: pageNum,
          limit: limitNum,
        },
        message: 'Assigned QC approvals retrieved successfully',
      });
    } catch (e) {
      next(e);
    }
  },
);

// List approvals assigned to a specific approver by ID (admin use) - allow admin, manager1, qc
router.get(
  '/assigned/user/:approverId',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  async (req, res, next) => {
    try {
      const { status = 'PENDING', page = 1, limit = 20 } = req.query as any;
      const { approverId } = req.params as any;
      const pageNum = parseInt(String(page), 10);
      const limitNum = parseInt(String(limit), 10);
      const skip = (pageNum - 1) * limitNum;

      const filter: any = { approvers: { $in: [approverId] } };
      if (status) filter.status = status;

      const { QCApproval } = await import('../models/qcApproval.model');
      const approvals = await QCApproval.find(filter)
        .populate('machineId', 'name category_id images')
        .populate('requestedBy', 'username name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
      const total = await QCApproval.countDocuments(filter);
      const pages = Math.ceil(total / limitNum);
      res.status(200).json({
        statusCode: 200,
        data: {
          approvals,
          total,
          pages,
          currentPage: pageNum,
          limit: limitNum,
        },
        message: 'User-assigned QC approvals retrieved successfully',
      });
    } catch (e) {
      next(e);
    }
  },
);

// Activate machine after approval - restrict to admin only
router.post(
  '/:id/activate',
  verifyJWT,
  AuthRole('admin'),
  checkPermission([ActionType.ACTIVATE_MACHINE]),
  validateRequest(qcApprovalIdParamSchema),
  QCApprovalController.activateMachine,
);

// Get QC approvals by machine ID - allow admin, manager1, qc
router.get(
  '/machine/:machineId',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  QCApprovalController.getQCApprovalsByMachine,
);

// Get QC approvals by user ID - allow admin, manager1, qc
router.get(
  '/user/:userId',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.VIEW_QC_APPROVAL]),
  QCApprovalController.getQCApprovalsByUser,
);

// Upload documents for QC approval - allow admin, manager1, qc
router.post(
  '/:id/documents',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.EDIT_QC_APPROVAL]),
  upload.array('documents', 10), // Allow up to 10 files
  QCApprovalController.uploadDocuments,
);

// Delete document from QC approval - allow admin, manager1, qc (for PENDING/REJECTED records)
router.delete(
  '/:id/documents/:documentId',
  verifyJWT,
  AuthRole(['admin', 'manager1', 'qc']),
  checkPermission([ActionType.EDIT_QC_APPROVAL]),
  QCApprovalController.deleteDocument,
);

export default router;
