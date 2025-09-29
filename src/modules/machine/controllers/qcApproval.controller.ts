/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import {
  QCApproval,
  QCApprovalStatus,
  QCApprovalType,
} from '../../../models/qcApproval.model';
import { Machine } from '../../../models/machine.model';
import { User } from '../../../models/user.model';
import {
  PermissionConfig,
  ActionType,
} from '../../../models/permissionConfig.model';
import { Role } from '../../../models/role.model';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import { asyncHandler } from '../../../utils/asyncHandler';
import { QAMachineEntry } from '../../../models/qcMachine.model';

/**
 * Get approvers for QC approval based on permission configuration
 */
const getQCApprovers = async (): Promise<string[]> => {
  try {
    // Lookup approver roles from active permission configs
    const configs = await PermissionConfig.find({
      action: ActionType.APPROVE_QC_APPROVAL,
      isActive: true,
    })
      .select('approverRoles')
      .lean();

    const approverRoleIds = Array.from(
      new Set(
        (configs || [])
          .flatMap((c: any) => c.approverRoles || [])
          .map((id: any) => id?.toString?.())
          .filter(Boolean),
      ),
    );

    let approvers;
    if (approverRoleIds.length) {
      approvers = await User.find({ role: { $in: approverRoleIds } }).select(
        '_id username name email role',
      );
    } else {
      // fallback: users whose role name is 'admin' or 'qc'
      const roles = await Role.find({ name: { $in: ['admin', 'qc'] } })
        .select('_id')
        .lean();
      const roleIds = roles.map((r: any) => r._id);
      approvers = await User.find({ role: { $in: roleIds } }).select(
        '_id username name email role',
      );
    }
    if (!approvers.length) {
      // last resort: any admin by role name
      const adminRole = await Role.findOne({ name: 'admin' }).select('_id');
      const fallback = adminRole
        ? await User.find({ role: adminRole._id }).select('_id')
        : [];
      return fallback.map((u: any) => u._id.toString());
    }
    return approvers.map((approver: any) => approver._id.toString());
  } catch (error) {
    console.error('Error getting QC approvers:', error);
    // Fallback to admin users only
    const adminRole = await Role.findOne({ name: 'admin' }).select('_id');
    if (!adminRole) return [];
    const adminUsers = await User.find({ role: adminRole._id }).select('_id');
    return adminUsers.map((admin: any) => admin._id.toString());
  }
};

/**
 * Get QC approval statistics
 */
export const getQCApprovalStatistics = asyncHandler(
  async (_req: Request, res: Response) => {
    const stats = await QCApproval.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statistics = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      activated: 0,
    };

    stats.forEach((stat) => {
      statistics.total += stat.count;
      switch (stat._id) {
        case QCApprovalStatus.PENDING:
          statistics.pending = stat.count;
          break;
        case QCApprovalStatus.APPROVED:
          statistics.approved = stat.count;
          break;
        case QCApprovalStatus.REJECTED:
          statistics.rejected = stat.count;
          break;
        case QCApprovalStatus.CANCELLED:
          statistics.cancelled = stat.count;
          break;
      }
    });

    // Count activated machines
    const activatedCount = await QCApproval.countDocuments({
      machineActivated: true,
    });
    statistics.activated = activatedCount;

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          statistics,
          'QC approval statistics retrieved successfully',
        ),
      );
  },
);

/**
 * Get all QC approvals with pagination and filters
 */
export const getAllQCApprovals = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      approvalType,
      dateFrom,
      dateTo,
      qualityScoreMin,
      qualityScoreMax,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      category,
      machineName,
      requestedBy,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object using aggregation for better search
    const matchStage: any = {};

    if (search) {
      matchStage.$or = [
        { 'machineId.name': { $regex: search, $options: 'i' } },
        { 'requestedBy.name': { $regex: search, $options: 'i' } },
        { 'requestedBy.username': { $regex: search, $options: 'i' } },
        { qcNotes: { $regex: search, $options: 'i' } },
        { requestNotes: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      matchStage.status = status;
    }

    if (approvalType) {
      matchStage.approvalType = approvalType;
    }

    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      if (dateFrom) {
        matchStage.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        matchStage.createdAt.$lte = new Date(dateTo as string);
      }
    }

    if (qualityScoreMin || qualityScoreMax) {
      matchStage.qualityScore = {};
      if (qualityScoreMin) {
        matchStage.qualityScore.$gte = parseInt(qualityScoreMin as string);
      }
      if (qualityScoreMax) {
        matchStage.qualityScore.$lte = parseInt(qualityScoreMax as string);
      }
    }

    // Build sort object
    const sortStage: any = {};
    sortStage[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pipeline: any[] = [
      {
        $lookup: {
          from: 'machines',
          localField: 'machineId',
          foreignField: '_id',
          as: 'machineId',
        },
      },
      {
        $unwind: '$machineId',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'machineId.category_id',
          foreignField: '_id',
          as: 'machineId.category_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.category_id',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'requestedBy',
          foreignField: '_id',
          as: 'requestedBy',
        },
      },
      {
        $unwind: '$requestedBy',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'approvedBy',
          foreignField: '_id',
          as: 'approvedBy',
        },
      },
      {
        $unwind: {
          path: '$approvedBy',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'rejectedBy',
          foreignField: '_id',
          as: 'rejectedBy',
        },
      },
      {
        $unwind: {
          path: '$rejectedBy',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Add additional filters after population
    if (category) {
      matchStage['machineId.category_id.name'] = {
        $regex: category,
        $options: 'i',
      };
    }

    if (machineName) {
      matchStage['machineId.name'] = { $regex: machineName, $options: 'i' };
    }

    if (requestedBy) {
      matchStage['requestedBy.username'] = {
        $regex: requestedBy,
        $options: 'i',
      };
    }

    // Add match stage if there are filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add sort and pagination
    pipeline.push(
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          'machineId.metadata': 0,
          'machineId.created_by': 0,
          'machineId.updated_by': 0,
          'machineId.is_approved': 0,
          'machineId.is_active': 0,
          'machineId.approvalStatus': 0,
          'machineId.decisionByName': 0,
          'machineId.decisionDate': 0,
          'requestedBy.password': 0,
          'requestedBy.refreshToken': 0,
          'requestedBy.role_id': 0,
          'requestedBy.department_id': 0,
          'approvedBy.password': 0,
          'approvedBy.refreshToken': 0,
          'approvedBy.role_id': 0,
          'approvedBy.department_id': 0,
          'rejectedBy.password': 0,
          'rejectedBy.refreshToken': 0,
          'rejectedBy.role_id': 0,
          'rejectedBy.department_id': 0,
        },
      },
    );

    const approvals = await QCApproval.aggregate(pipeline);

    // Get total count with same filters
    const countPipeline: any[] = [
      {
        $lookup: {
          from: 'machines',
          localField: 'machineId',
          foreignField: '_id',
          as: 'machineId',
        },
      },
      {
        $unwind: '$machineId',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'machineId.category_id',
          foreignField: '_id',
          as: 'machineId.category_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.category_id',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'requestedBy',
          foreignField: '_id',
          as: 'requestedBy',
        },
      },
      {
        $unwind: '$requestedBy',
      },
    ];

    // Add match stage for count
    if (Object.keys(matchStage).length > 0) {
      countPipeline.push({ $match: matchStage });
    }

    countPipeline.push({ $count: 'total' });

    const countResult = await QCApproval.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;
    const pages = Math.ceil(total / limitNum);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          approvals,
          total,
          pages,
          currentPage: pageNum,
          limit: limitNum,
        },
        'QC approvals retrieved successfully',
      ),
    );
  },
);

/**
 * Get QC approval by ID
 */
export const getQCApprovalById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const approval = await QCApproval.findById(id)
      .populate('machineId', 'name category_id images metadata')
      .populate('requestedBy', 'username name email')
      .populate('approvedBy', 'username name email')
      .populate('rejectedBy', 'username name email')
      .populate('approvers', 'username name email')
      .populate('qcEntryId', 'files')
      .populate('machineId.category_id', 'name description')
      .lean();

    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    res
      .status(200)
      .json(
        new ApiResponse(200, approval, 'QC approval retrieved successfully'),
      );
  },
);

/**
 * Create new QC approval
 */
export const createQCApproval = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      machineId,
      qcEntryId,
      approvalType,
      qcNotes,
      qcFindings,
      qualityScore,
      inspectionDate,
      nextInspectionDate,
      requestNotes,
    } = req.body;

    const userId = (req as any).user?.id;

    // Verify machine exists and is approved
    const machine = await Machine.findById(machineId);
    if (!machine) {
      throw new ApiError(
        'MACHINE_NOT_FOUND',
        404,
        'MACHINE_NOT_FOUND',
        'Machine not found',
      );
    }

    if (!machine.is_approved) {
      throw new ApiError(
        'MACHINE_NOT_APPROVED',
        400,
        'MACHINE_NOT_APPROVED',
        'Machine must be approved before QC approval',
      );
    }

    // Check if there's already a pending approval for this machine
    const existingApproval = await QCApproval.findOne({
      machineId,
      status: QCApprovalStatus.PENDING,
    });

    if (existingApproval) {
      throw new ApiError(
        'PENDING_QC_APPROVAL_EXISTS',
        400,
        'PENDING_QC_APPROVAL_EXISTS',
        'There is already a pending QC approval for this machine',
      );
    }

    // Get approvers based on permission configuration
    const approvers = await getQCApprovers();

    const approval = new QCApproval({
      machineId,
      qcEntryId,
      requestedBy: userId,
      approvalType: approvalType || QCApprovalType.MACHINE_QC_ENTRY,
      qcNotes,
      qcFindings,
      qualityScore,
      inspectionDate: inspectionDate ? new Date(inspectionDate) : undefined,
      nextInspectionDate: nextInspectionDate
        ? new Date(nextInspectionDate)
        : undefined,
      requestNotes,
      approvers, // Assign approvers based on permission configuration
      proposedChanges: {
        qcNotes,
        qcFindings,
        qualityScore,
        inspectionDate,
        nextInspectionDate,
      },
    });

    await approval.save();

    const populatedApproval = await QCApproval.findById(approval._id)
      .populate('machineId', 'name category_id images')
      .populate('requestedBy', 'username name email')
      .populate('machineId.category_id', 'name')
      .lean();

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          populatedApproval,
          'QC approval created successfully',
        ),
      );
  },
);

/**
 * Programmatic helper to create a QC approval (without Express req/res)
 */
export const createQCApprovalForEntry = async (
  args: {
    machineId: string;
    qcEntryId?: string;
    approvalType?: string;
    qcNotes?: string;
    qcFindings?: Record<string, unknown>;
    qualityScore?: number;
    inspectionDate?: string | Date;
    nextInspectionDate?: string | Date;
    requestNotes?: string;
  },
  requestedByUserId: string,
) => {
  const {
    machineId,
    qcEntryId,
    approvalType,
    qcNotes,
    qcFindings,
    qualityScore,
    inspectionDate,
    nextInspectionDate,
    requestNotes,
  } = args;

  const machine = await Machine.findById(machineId);
  if (!machine) {
    throw new ApiError(
      'MACHINE_NOT_FOUND',
      404,
      'MACHINE_NOT_FOUND',
      'Machine not found',
    );
  }

  if (!machine.is_approved) {
    throw new ApiError(
      'MACHINE_NOT_APPROVED',
      400,
      'MACHINE_NOT_APPROVED',
      'Machine must be approved before QC approval',
    );
  }

  const existingApproval = await QCApproval.findOne({
    machineId,
    status: QCApprovalStatus.PENDING,
  });
  if (existingApproval) {
    return existingApproval;
  }

  const approvers = await getQCApprovers();

  const approval = new QCApproval({
    machineId,
    qcEntryId,
    requestedBy: requestedByUserId,
    approvalType: approvalType || QCApprovalType.MACHINE_QC_ENTRY,
    qcNotes,
    qcFindings,
    qualityScore,
    inspectionDate: inspectionDate ? new Date(inspectionDate) : undefined,
    nextInspectionDate: nextInspectionDate
      ? new Date(nextInspectionDate)
      : undefined,
    requestNotes,
    approvers,
    proposedChanges: {
      qcNotes,
      qcFindings,
      qualityScore,
      inspectionDate,
      nextInspectionDate,
    },
  });

  await approval.save();
  return approval;
};

/**
 * Update QC approval
 */
export const updateQCApproval = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const approval = await QCApproval.findById(id);
    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    // Only allow updates if status is PENDING
    if (approval.status !== QCApprovalStatus.PENDING) {
      throw new ApiError(
        'CANNOT_UPDATE_QC_APPROVAL',
        400,
        'CANNOT_UPDATE_QC_APPROVAL',
        'Cannot update approved/rejected QC approval',
      );
    }

    // Update proposed changes
    if (updateData['qcNotes'] !== undefined) {
      approval.qcNotes = updateData['qcNotes'];
      approval.proposedChanges['qcNotes'] = updateData['qcNotes'];
    }
    if (updateData['qcFindings'] !== undefined) {
      approval.qcFindings = updateData['qcFindings'];
      approval.proposedChanges['qcFindings'] = updateData['qcFindings'];
    }
    if (updateData['qualityScore'] !== undefined) {
      approval.qualityScore = updateData['qualityScore'];
      approval.proposedChanges['qualityScore'] = updateData['qualityScore'];
    }
    if (updateData['inspectionDate'] !== undefined) {
      if (updateData['inspectionDate']) {
        approval.inspectionDate = new Date(
          updateData['inspectionDate'] as string,
        );
      } else {
        approval.inspectionDate = undefined as any;
      }
      approval.proposedChanges['inspectionDate'] = updateData['inspectionDate'];
    }
    if (updateData['nextInspectionDate'] !== undefined) {
      if (updateData['nextInspectionDate']) {
        approval.nextInspectionDate = new Date(
          updateData['nextInspectionDate'] as string,
        );
      } else {
        approval.nextInspectionDate = undefined as any;
      }
      approval.proposedChanges['nextInspectionDate'] =
        updateData['nextInspectionDate'];
    }
    if (updateData.requestNotes !== undefined) {
      approval.requestNotes = updateData.requestNotes;
    }

    await approval.save();

    const updatedApproval = await QCApproval.findById(approval._id)
      .populate('machineId', 'name category_id images')
      .populate('requestedBy', 'username name email')
      .populate('machineId.category_id', 'name')
      .lean();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedApproval,
          'QC approval updated successfully',
        ),
      );
  },
);

/**
 * Delete QC approval
 */
export const deleteQCApproval = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const approval = await QCApproval.findById(id);
    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    // Only allow deletion if status is PENDING or CANCELLED
    if (
      approval.status === QCApprovalStatus.APPROVED ||
      approval.status === QCApprovalStatus.REJECTED
    ) {
      throw new ApiError(
        'CANNOT_DELETE_QC_APPROVAL',
        400,
        'CANNOT_DELETE_QC_APPROVAL',
        'Cannot delete approved/rejected QC approval',
      );
    }

    await QCApproval.findByIdAndDelete(id);

    res
      .status(200)
      .json(new ApiResponse(200, null, 'QC approval deleted successfully'));
  },
);

/**
 * Process QC approval action (approve/reject)
 */
export const processQCApprovalAction = asyncHandler(
  async (req: Request, res: Response) => {
    const { approvalId, action, notes } = req.body;
    const userId = (req as any).user?.id;

    const approval = await QCApproval.findById(approvalId);
    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    if (approval.status !== QCApprovalStatus.PENDING) {
      throw new ApiError(
        'QC_APPROVAL_NOT_PENDING',
        400,
        'QC_APPROVAL_NOT_PENDING',
        'QC approval is not in pending status',
      );
    }

    if (action === 'approve') {
      approval.status = QCApprovalStatus.APPROVED;
      approval.approvedBy = userId;
      approval.approvalDate = new Date();
      approval.approverNotes = notes;
      // Mirror dispatch: mark related QC entry active and approved
      if (approval.qcEntryId) {
        await QAMachineEntry.findByIdAndUpdate(approval.qcEntryId, {
          is_active: true,
          approval_status: 'APPROVED',
          rejection_reason: undefined,
        } as any);
      }
    } else if (action === 'reject') {
      approval.status = QCApprovalStatus.REJECTED;
      approval.rejectedBy = userId;
      approval.approvalDate = new Date();
      approval.rejectionReason = notes;
      // Mirror dispatch: keep QC entry inactive and set rejection reason
      if (approval.qcEntryId) {
        await QAMachineEntry.findByIdAndUpdate(approval.qcEntryId, {
          is_active: false,
          approval_status: 'REJECTED',
          rejection_reason: notes,
        } as any);
      }
    } else {
      throw new ApiError(
        'INVALID_ACTION',
        400,
        'INVALID_ACTION',
        'Invalid action. Must be "approve" or "reject"',
      );
    }

    await approval.save();

    const updatedApproval = await QCApproval.findById(approval._id)
      .populate('machineId', 'name category_id images')
      .populate('requestedBy', 'username name email')
      .populate('approvedBy', 'username name email')
      .populate('rejectedBy', 'username name email')
      .populate('machineId.category_id', 'name')
      .lean();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedApproval,
          `QC approval ${action}d successfully`,
        ),
      );
  },
);

/**
 * Activate machine after approval
 */
export const activateMachine = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const approval = await QCApproval.findById(id);
    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    if (approval.status !== QCApprovalStatus.APPROVED) {
      throw new ApiError(
        'MACHINE_NOT_APPROVED_FOR_ACTIVATION',
        400,
        'MACHINE_NOT_APPROVED_FOR_ACTIVATION',
        'Machine can only be activated after approval',
      );
    }

    if (approval.machineActivated) {
      throw new ApiError(
        'MACHINE_ALREADY_ACTIVATED',
        400,
        'MACHINE_ALREADY_ACTIVATED',
        'Machine is already activated',
      );
    }

    // Update machine status
    await Machine.findByIdAndUpdate(approval.machineId, {
      is_active: true,
      activatedAt: new Date(),
    });

    // Update approval
    approval.machineActivated = true;
    approval.activationDate = new Date();
    await approval.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { activated: true },
          'Machine activated successfully',
        ),
      );
  },
);

/**
 * Get QC approvals by machine ID
 */
export const getQCApprovalsByMachine = asyncHandler(
  async (req: Request, res: Response) => {
    const { machineId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const approvals = await QCApproval.find({ machineId })
      .populate('requestedBy', 'username name email')
      .populate('approvedBy', 'username name email')
      .populate('rejectedBy', 'username name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await QCApproval.countDocuments({ machineId });
    const pages = Math.ceil(total / limitNum);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          approvals,
          total,
          pages,
          currentPage: pageNum,
          limit: limitNum,
        },
        'QC approvals retrieved successfully',
      ),
    );
  },
);

/**
 * Get QC approvals by user ID
 */
export const getQCApprovalsByUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const approvals = await QCApproval.find({ requestedBy: userId })
      .populate('machineId', 'name category_id images')
      .populate('machineId.category_id', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await QCApproval.countDocuments({ requestedBy: userId });
    const pages = Math.ceil(total / limitNum);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          approvals,
          total,
          pages,
          currentPage: pageNum,
          limit: limitNum,
        },
        'QC approvals retrieved successfully',
      ),
    );
  },
);

/**
 * Upload documents for QC approval
 */
export const uploadDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ApiError(
        'NO_FILES_UPLOADED',
        400,
        'NO_FILES_UPLOADED',
        'No files uploaded',
      );
    }

    const approval = await QCApproval.findById(id);
    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    if (approval.status !== QCApprovalStatus.PENDING) {
      throw new ApiError(
        'CANNOT_UPLOAD_DOCUMENTS',
        400,
        'CANNOT_UPLOAD_DOCUMENTS',
        'Cannot upload documents for non-pending QC approval',
      );
    }

    // Process uploaded files
    const documents = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    }));

    // Add documents to approval
    if (!approval.documents) {
      approval.documents = [];
    }
    approval.documents.push(...documents);

    await approval.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { documents: approval.documents },
          'Documents uploaded successfully',
        ),
      );
  },
);

/**
 * Delete document from QC approval
 */
export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const { id, documentId } = req.params;

    const approval = await QCApproval.findById(id);
    if (!approval) {
      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        'QC approval not found',
      );
    }

    if (approval.status !== QCApprovalStatus.PENDING) {
      throw new ApiError(
        'CANNOT_DELETE_DOCUMENTS',
        400,
        'CANNOT_DELETE_DOCUMENTS',
        'Cannot delete documents from non-pending QC approval',
      );
    }

    if (!approval.documents || approval.documents.length === 0) {
      throw new ApiError(
        'NO_DOCUMENTS_FOUND',
        404,
        'NO_DOCUMENTS_FOUND',
        'No documents found',
      );
    }

    const documentIndex = approval.documents.findIndex(
      (doc: any) => doc._id?.toString() === documentId,
    );
    if (documentIndex === -1) {
      throw new ApiError(
        'DOCUMENT_NOT_FOUND',
        404,
        'DOCUMENT_NOT_FOUND',
        'Document not found',
      );
    }

    // Remove document from array
    approval.documents.splice(documentIndex, 1);
    await approval.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { documents: approval.documents },
          'Document deleted successfully',
        ),
      );
  },
);

const QCApprovalController = {
  getQCApprovalStatistics,
  getAllQCApprovals,
  getQCApprovalById,
  createQCApproval,
  updateQCApproval,
  deleteQCApproval,
  processQCApprovalAction,
  activateMachine,
  getQCApprovalsByMachine,
  getQCApprovalsByUser,
  uploadDocuments,
  deleteDocument,
};

export default QCApprovalController;
