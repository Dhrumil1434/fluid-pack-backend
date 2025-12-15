/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
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
  async (req: Request, res: Response) => {
    const { requestedBy } = req.query;

    console.log('[QC Approval Controller] getQCApprovalStatistics called');
    console.log('[QC Approval Controller] requestedBy filter:', requestedBy);

    // Build match stage for filtering
    const matchStage: any = {};

    // IMPORTANT: QC Dashboard statistics should ONLY count MACHINE_QC_ENTRY type approvals
    // MACHINE_QC_EDIT is part of machine approval workflow, not QC workflow
    matchStage.approvalType = QCApprovalType.MACHINE_QC_ENTRY;

    // If filtering by requestedBy, look up the user first
    if (requestedBy) {
      console.log(
        '[QC Approval Controller] Looking up user for statistics filter:',
        requestedBy,
      );

      let userId: mongoose.Types.ObjectId | null = null;

      // First check if requestedBy is a valid ObjectId - if so, use it directly
      if (mongoose.Types.ObjectId.isValid(requestedBy as string)) {
        try {
          userId = new mongoose.Types.ObjectId(requestedBy as string);
          // Verify the user exists
          const user = await User.findById(userId)
            .select('_id username name email')
            .lean();
          if (user) {
            const userData = user as any;
            console.log(
              '[QC Approval Controller] Found user by ObjectId for statistics filter:',
              {
                _id: userId.toString(),
                username: userData.username,
                name: userData.name,
                email: userData.email,
              },
            );
          } else {
            console.warn(
              '[QC Approval Controller] User ObjectId is valid but user not found:',
              requestedBy,
            );
            userId = null; // Reset if user doesn't exist
          }
        } catch (error) {
          console.warn(
            '[QC Approval Controller] Error converting requestedBy to ObjectId:',
            error,
          );
          userId = null;
        }
      }

      // If not found by ObjectId, try searching by username/name/email
      if (!userId) {
        // Try exact match first (more efficient and accurate)
        let user = await User.findOne({
          $or: [
            { username: requestedBy },
            { name: requestedBy },
            { email: requestedBy },
          ],
        })
          .select('_id username name email')
          .lean();

        // If exact match not found, try regex match
        if (!user) {
          user = await User.findOne({
            $or: [
              { username: { $regex: requestedBy, $options: 'i' } },
              { name: { $regex: requestedBy, $options: 'i' } },
              { email: { $regex: requestedBy, $options: 'i' } },
            ],
          })
            .select('_id username name email')
            .lean();
        }

        if (user && user._id) {
          userId = new mongoose.Types.ObjectId(String(user._id));
          const userData = user as any;
          console.log(
            '[QC Approval Controller] Filtering statistics by requestedBy user:',
            {
              _id: userId.toString(),
              username: userData.username,
              name: userData.name,
              email: userData.email,
            },
          );
        }
      }

      if (userId) {
        matchStage.requestedBy = userId;
      } else {
        console.warn(
          '[QC Approval Controller] No user found for statistics filter, returning zeros',
        );
        // Return zeros if user not found
        return res.status(200).json(
          new ApiResponse(
            200,
            {
              total: 0,
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
              activated: 0,
            },
            'QC approval statistics retrieved successfully',
          ),
        );
      }
    }

    // Build aggregation pipeline for statistics
    // We need to check both approval.requestedBy AND qcEntryId.added_by
    const pipeline: any[] = [];

    // IMPORTANT: Always filter by approvalType first (only MACHINE_QC_ENTRY for QC dashboard)
    // This ensures statistics only count QC entry approvals, not machine edit approvals
    pipeline.push({
      $match: {
        approvalType:
          matchStage.approvalType || QCApprovalType.MACHINE_QC_ENTRY,
      },
    });

    // If filtering by requestedBy, we need to lookup qcEntryId first to check added_by
    if (matchStage.requestedBy) {
      const requestedByUserId = matchStage.requestedBy;

      // Lookup qcEntryId to access added_by field
      pipeline.push(
        {
          $lookup: {
            from: 'qamachineentries',
            localField: 'qcEntryId',
            foreignField: '_id',
            as: 'qcEntryId',
          },
        },
        {
          $unwind: {
            path: '$qcEntryId',
            preserveNullAndEmptyArrays: true,
          },
        },
      );

      // Match if EITHER requestedBy OR qcEntryId.added_by matches
      pipeline.push({
        $match: {
          $or: [
            { requestedBy: requestedByUserId },
            { 'qcEntryId.added_by': requestedByUserId },
          ],
        },
      });
    }

    // Group by status
    pipeline.push({
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    });

    const stats = await QCApproval.aggregate(pipeline);

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

    // Count activated machines (with requestedBy filter if applicable)
    // Use OR logic: match if either requestedBy OR qcEntryId.added_by matches
    // IMPORTANT: Only count MACHINE_QC_ENTRY type approvals
    if (matchStage.requestedBy) {
      const requestedByUserId = matchStage.requestedBy;
      // Use aggregation to count activated approvals with OR logic
      const activatedPipeline: any[] = [
        {
          $match: {
            approvalType: QCApprovalType.MACHINE_QC_ENTRY, // Only QC Entry approvals
          },
        },
        {
          $lookup: {
            from: 'qamachineentries',
            localField: 'qcEntryId',
            foreignField: '_id',
            as: 'qcEntryId',
          },
        },
        {
          $unwind: {
            path: '$qcEntryId',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            machineActivated: true,
            $or: [
              { requestedBy: requestedByUserId },
              { 'qcEntryId.added_by': requestedByUserId },
            ],
          },
        },
        { $count: 'total' },
      ];
      const activatedResult = await QCApproval.aggregate(activatedPipeline);
      statistics.activated =
        activatedResult.length > 0 ? activatedResult[0].total : 0;
    } else {
      const activatedCount = await QCApproval.countDocuments({
        machineActivated: true,
        approvalType: QCApprovalType.MACHINE_QC_ENTRY, // Only QC Entry approvals
      });
      statistics.activated = activatedCount;
    }

    console.log('[QC Approval Controller] Statistics calculated:', statistics);

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
    console.log('[QC Approval Controller] getAllQCApprovals called');
    console.log('[QC Approval Controller] Query params:', req.query);

    const {
      page = 1,
      limit = 10,
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
      subcategory,
      machineName,
      machineSequence,
      requestedBy,
      partyName,
      location,
      mobileNumber,
      dispatchDateFrom,
      dispatchDateTo,
      qcDateFrom,
      qcDateTo,
      inspectionDateFrom,
      inspectionDateTo,
    } = req.query;

    console.log('[QC Approval Controller] Parsed params:', {
      page,
      limit,
      search,
      status,
      approvalType,
      requestedBy,
      sortBy,
      sortOrder,
    });

    // Set defaults for pagination
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit
      ? Math.max(1, Math.min(100, parseInt(limit as string, 10)))
      : 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter object using aggregation for better search
    const matchStage: any = {};

    // IMPORTANT: QC Dashboard should ONLY show MACHINE_QC_ENTRY type approvals
    // MACHINE_QC_EDIT is part of machine approval workflow, not QC workflow
    // Only filter by approvalType if explicitly provided, otherwise default to MACHINE_QC_ENTRY
    if (approvalType) {
      matchStage.approvalType = approvalType;
    } else {
      // Default: Only show QC Entry approvals (exclude machine edit approvals)
      matchStage.approvalType = QCApprovalType.MACHINE_QC_ENTRY;
    }

    if (search) {
      matchStage.$or = [
        { 'machineId.so_id.name': { $regex: search, $options: 'i' } },
        { 'machineId.machine_sequence': { $regex: search, $options: 'i' } },
        {
          'machineId.so_id.category_id.name': { $regex: search, $options: 'i' },
        },
        {
          'machineId.so_id.subcategory_id.name': {
            $regex: search,
            $options: 'i',
          },
        },
        { 'machineId.so_id.party_name': { $regex: search, $options: 'i' } },
        { 'machineId.location': { $regex: search, $options: 'i' } },
        { 'machineId.so_id.mobile_number': { $regex: search, $options: 'i' } },
        { 'requestedBy.name': { $regex: search, $options: 'i' } },
        { 'requestedBy.username': { $regex: search, $options: 'i' } },
        { 'requestedBy.email': { $regex: search, $options: 'i' } },
        { 'approvedBy.name': { $regex: search, $options: 'i' } },
        { 'approvedBy.username': { $regex: search, $options: 'i' } },
        { 'rejectedBy.name': { $regex: search, $options: 'i' } },
        { 'rejectedBy.username': { $regex: search, $options: 'i' } },
        { qcNotes: { $regex: search, $options: 'i' } },
        { requestNotes: { $regex: search, $options: 'i' } },
        { approverNotes: { $regex: search, $options: 'i' } },
        { rejectionReason: { $regex: search, $options: 'i' } },
        { approvalType: { $regex: search, $options: 'i' } },
        // QC Entry fields (from qamachineentries)
        { 'qcEntryId.name': { $regex: search, $options: 'i' } },
        { 'qcEntryId.machine_sequence': { $regex: search, $options: 'i' } },
        { 'qcEntryId.party_name': { $regex: search, $options: 'i' } },
        { 'qcEntryId.location': { $regex: search, $options: 'i' } },
        { 'qcEntryId.mobile_number': { $regex: search, $options: 'i' } },
        { 'qcEntryId.qcNotes': { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      matchStage.status = status;
    }

    // Note: approvalType filter is already set above (defaults to MACHINE_QC_ENTRY)
    // Only override if explicitly provided in query params

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

    // Build sort object - map frontend sort fields to backend fields
    const sortStage: any = {};
    const sortOrderNum = sortOrder === 'desc' ? -1 : 1;

    // Map frontend sort field names to actual database field paths
    const sortFieldMap: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      qualityScore: 'qualityScore',
      status: 'status',
      approvalType: 'approvalType',
      category: 'categoryNameForSort', // Use computed field for reliable sorting
      inspectionDate: 'inspectionDateForSort', // Use computed field
      qc_date: 'qcDateForSort', // Use computed field
      dispatch_date: 'dispatchDateForSort', // Use computed field
      machineName: 'machineId.so_id.name',
      partyName: 'partyNameForSort', // Use computed field
      location: 'locationForSort', // Use computed field
      mobileNumber: 'mobileNumberForSort', // Use computed field
      requestedBy: 'requestedByForSort', // Use computed field
    };

    const actualSortField =
      sortFieldMap[sortBy as string] || (sortBy as string);
    sortStage[actualSortField] = sortOrderNum;

    // If filtering by requestedBy, first look up the user to get their ObjectId
    let requestedByUserId: mongoose.Types.ObjectId | null = null;
    if (requestedBy) {
      console.log(
        '[QC Approval Controller] Looking up user by requestedBy filter:',
        requestedBy,
      );

      // First check if requestedBy is a valid ObjectId - if so, use it directly
      if (mongoose.Types.ObjectId.isValid(requestedBy as string)) {
        try {
          requestedByUserId = new mongoose.Types.ObjectId(
            requestedBy as string,
          );
          // Verify the user exists
          const user = await User.findById(requestedByUserId)
            .select('_id username name email')
            .lean();
          if (user) {
            const userData = user as any;
            console.log(
              '[QC Approval Controller] Found user by ObjectId for requestedBy filter:',
              {
                _id: requestedByUserId.toString(),
                username: userData.username,
                name: userData.name,
                email: userData.email,
              },
            );
          } else {
            console.warn(
              '[QC Approval Controller] User ObjectId is valid but user not found:',
              requestedBy,
            );
            requestedByUserId = null; // Reset if user doesn't exist
          }
        } catch (error) {
          console.warn(
            '[QC Approval Controller] Error converting requestedBy to ObjectId:',
            error,
          );
          requestedByUserId = null;
        }
      }

      // If not found by ObjectId, try searching by username/name/email
      if (!requestedByUserId) {
        console.log(
          '[QC Approval Controller] Searching for user with username/name/email matching:',
          requestedBy,
        );

        // Try exact match first (more efficient and accurate)
        let user = await User.findOne({
          $or: [
            { username: requestedBy },
            { name: requestedBy },
            { email: requestedBy },
          ],
        })
          .select('_id username name email')
          .lean();

        // If exact match not found, try regex match
        if (!user) {
          user = await User.findOne({
            $or: [
              { username: { $regex: requestedBy, $options: 'i' } },
              { name: { $regex: requestedBy, $options: 'i' } },
              { email: { $regex: requestedBy, $options: 'i' } },
            ],
          })
            .select('_id username name email')
            .lean();
        }

        if (user && user._id) {
          requestedByUserId = new mongoose.Types.ObjectId(String(user._id));
          const userData = user as any;
          console.log(
            '[QC Approval Controller] Found user for requestedBy filter:',
            {
              _id: requestedByUserId.toString(),
              username: userData.username,
              name: userData.name,
              email: userData.email,
            },
          );
        } else {
          console.warn(
            '[QC Approval Controller] No user found matching requestedBy filter:',
            requestedBy,
          );
          console.warn(
            '[QC Approval Controller] This will result in no approvals being returned!',
          );
        }
      }
    }

    const pipeline: any[] = [];

    // IMPORTANT: We don't filter by requestedBy at the start because we need to check
    // both approval.requestedBy AND qcEntryId.added_by after lookups
    // This ensures we catch all approvals created by the user, regardless of
    // whether they match via the approval's requestedBy or the QC entry's added_by

    // Start with approvalType filter only
    pipeline.push({
      $match: {
        approvalType:
          matchStage.approvalType || QCApprovalType.MACHINE_QC_ENTRY,
      },
    });

    // Now do the machine lookup
    pipeline.push(
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
    );

    // Lookup SO (Sales Order) - machines now reference SO instead of direct category
    pipeline.push(
      {
        $lookup: {
          from: 'sos',
          localField: 'machineId.so_id',
          foreignField: '_id',
          as: 'machineId.so_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.so_id',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // Filter by category _id after SO lookup (if category is ObjectId)
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category as string)) {
        // Filter by category _id via SO
        pipeline.push({
          $match: {
            'machineId.so_id.category_id': new mongoose.Types.ObjectId(
              category as string,
            ),
          },
        });
      }
    }

    // Continue with SO's category and subcategory lookups
    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'machineId.so_id.category_id',
          foreignField: '_id',
          as: 'machineId.so_id.category_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.so_id.category_id',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'machineId.so_id.subcategory_id',
          foreignField: '_id',
          as: 'machineId.so_id.subcategory_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.so_id.subcategory_id',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Add computed fields for reliable sorting (BEFORE requestedBy lookup)
      {
        $addFields: {
          categoryNameForSort: {
            $ifNull: ['$machineId.so_id.category_id.name', ''],
          },
          partyNameForSort: {
            $ifNull: [
              {
                $ifNull: [
                  '$qcEntryId.party_name',
                  '$machineId.so_id.party_name',
                ],
              },
              '',
            ],
          },
          locationForSort: {
            $ifNull: [
              { $ifNull: ['$qcEntryId.location', '$machineId.location'] },
              '',
            ],
          },
          mobileNumberForSort: {
            $ifNull: [
              {
                $ifNull: [
                  '$qcEntryId.mobile_number',
                  '$machineId.so_id.mobile_number',
                ],
              },
              '',
            ],
          },
          dispatchDateForSort: {
            $ifNull: ['$qcEntryId.dispatch_date', new Date(0)],
          },
          qcDateForSort: {
            $ifNull: ['$qcEntryId.qc_date', new Date(0)],
          },
          inspectionDateForSort: {
            $ifNull: ['$qcEntryId.inspectionDate', new Date(0)],
          },
        },
      },
      // Lookup requestedBy user (QC person who created the QC entry, NOT machine creator)
      {
        $lookup: {
          from: 'users',
          localField: 'requestedBy', // This is the QC approval's requestedBy field
          foreignField: '_id',
          as: 'requestedBy',
        },
      },
      {
        $unwind: {
          path: '$requestedBy',
          preserveNullAndEmptyArrays: true, // Don't drop documents if requestedBy lookup fails
        },
      },
      // Add requestedByForSort AFTER lookup so requestedBy is populated
      {
        $addFields: {
          requestedByForSort: {
            $ifNull: [
              {
                $concat: [
                  { $ifNull: ['$requestedBy.name', ''] },
                  ' ',
                  { $ifNull: ['$requestedBy.username', ''] },
                ],
              },
              '',
            ],
          },
        },
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
      {
        $lookup: {
          from: 'qamachineentries',
          localField: 'qcEntryId',
          foreignField: '_id',
          as: 'qcEntryId',
        },
      },
      {
        $unwind: {
          path: '$qcEntryId',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // IMPORTANT: After qcEntryId lookup, add filter for requestedByUserId if it exists
    // This matches EITHER approval.requestedBy OR qcEntryId.added_by (raw ObjectId field)
    // We match on the raw ObjectId field BEFORE populating it
    if (requestedByUserId) {
      console.log(
        '[QC Approval Controller] Adding filter for requestedBy user (OR logic after qcEntryId lookup):',
        requestedByUserId.toString(),
      );
      console.log(
        '[QC Approval Controller] Will match if approval.requestedBy OR qcEntryId.added_by (raw ObjectId) matches',
      );

      // Match EITHER approval.requestedBy OR qcEntryId.added_by
      // Both are ObjectId fields at this point (before user population)
      // Use $expr with $eq for reliable ObjectId comparison, or direct comparison
      // Handle case where qcEntryId might be null
      pipeline.push({
        $match: {
          $or: [
            { requestedBy: requestedByUserId }, // Match approval's requestedBy ObjectId (direct comparison)
            {
              // Match QC entry's added_by ObjectId (raw field) - only if qcEntryId exists
              $and: [
                { qcEntryId: { $exists: true, $ne: null } }, // Ensure qcEntryId exists
                { 'qcEntryId.added_by': requestedByUserId }, // Match QC entry's added_by ObjectId (direct comparison)
              ],
            },
          ],
        },
      });
      console.log(
        '[QC Approval Controller] Filter will match approvals where:',
      );
      console.log('  - requestedBy =', requestedByUserId.toString(), 'OR');
      console.log(
        '  - (qcEntryId exists AND qcEntryId.added_by =',
        requestedByUserId.toString(),
        ')',
      );
    }

    // Now lookup the added_by user from the QC entry (for display purposes)
    // This allows us to display qcEntryId.added_by.username, name, or email
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'qcEntryId.added_by',
          foreignField: '_id',
          as: 'qcEntryId.added_by',
        },
      },
      {
        $unwind: {
          path: '$qcEntryId.added_by',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // Continue with additional computed fields
    pipeline.push(
      // Add computed fields for reliable sorting (after all lookups)
      {
        $addFields: {
          categoryNameForSort: {
            $ifNull: ['$machineId.so_id.category_id.name', ''],
          },
          requestedByForSort: {
            $ifNull: [
              {
                $concat: [
                  { $ifNull: ['$requestedBy.name', ''] },
                  ' ',
                  { $ifNull: ['$requestedBy.username', ''] },
                ],
              },
              '',
            ],
          },
          partyNameForSort: {
            $ifNull: [
              {
                $ifNull: [
                  '$qcEntryId.party_name',
                  '$machineId.so_id.party_name',
                ],
              },
              '',
            ],
          },
          locationForSort: {
            $ifNull: [
              { $ifNull: ['$qcEntryId.location', '$machineId.location'] },
              '',
            ],
          },
          mobileNumberForSort: {
            $ifNull: [
              {
                $ifNull: [
                  '$qcEntryId.mobile_number',
                  '$machineId.so_id.mobile_number',
                ],
              },
              '',
            ],
          },
          dispatchDateForSort: {
            $ifNull: ['$qcEntryId.dispatch_date', new Date(0)],
          },
          qcDateForSort: {
            $ifNull: ['$qcEntryId.qc_date', new Date(0)],
          },
          inspectionDateForSort: {
            $ifNull: ['$qcEntryId.inspectionDate', new Date(0)],
          },
        },
      },
    );

    // Add additional filters after population
    if (category) {
      const isObjectId = mongoose.Types.ObjectId.isValid(category as string);
      if (!isObjectId) {
        // Filter by category name (for text search) - only if not ObjectId
        // ObjectId filtering is done before lookups for efficiency
        matchStage['machineId.so_id.category_id.name'] = {
          $regex: category,
          $options: 'i',
        };
      }
    }

    if (subcategory) {
      matchStage['machineId.so_id.subcategory_id.name'] = {
        $regex: subcategory,
        $options: 'i',
      };
    }

    if (machineName) {
      matchStage['machineId.so_id.name'] = {
        $regex: machineName,
        $options: 'i',
      };
    }

    if (machineSequence) {
      matchStage['machineId.machine_sequence'] = {
        $regex: machineSequence,
        $options: 'i',
      };
    }

    // IMPORTANT: Filter by requestedBy user - we already filtered by approval.requestedBy
    // at the start of the pipeline. Now we need to also include approvals where
    // qcEntryId.added_by matches the user (this will be applied AFTER qcEntryId lookup)
    // We'll add this as a separate $match stage after the qcEntryId lookup

    // Remove requestedByUserId from matchStage since we handle it separately
    // (already applied at pipeline start for requestedBy, will apply after lookup for qcEntryId.added_by)

    // IMPORTANT: Only use text-based fallback if requestedByUserId was NOT found
    // If requestedByUserId exists, we use ObjectId-based filtering (more reliable)
    if (requestedBy && !requestedByUserId) {
      // Fallback: if user not found by ObjectId, try filtering by populated fields after lookup
      // This will be applied in the pipeline AFTER the lookups happen
      console.log(
        '[QC Approval Controller] User not found by ObjectId, will filter by populated fields after lookup:',
        requestedBy,
      );

      // Filter by populated fields after lookup (applied in pipeline after lookups)
      const requestedByTextFilter = {
        $or: [
          { 'requestedBy.name': { $regex: requestedBy, $options: 'i' } },
          { 'requestedBy.username': { $regex: requestedBy, $options: 'i' } },
          { 'requestedBy.email': { $regex: requestedBy, $options: 'i' } },
          // Also try QC entry's added_by populated field (after lookup)
          { 'qcEntryId.added_by.name': { $regex: requestedBy, $options: 'i' } },
          {
            'qcEntryId.added_by.username': {
              $regex: requestedBy,
              $options: 'i',
            },
          },
          {
            'qcEntryId.added_by.email': { $regex: requestedBy, $options: 'i' },
          },
        ],
      };

      // Combine with existing matchStage conditions
      if (matchStage.$and) {
        matchStage.$and.push(requestedByTextFilter);
      } else if (matchStage.$or) {
        const originalOr = matchStage.$or;
        delete matchStage.$or;
        matchStage.$and = [{ $or: originalOr }, requestedByTextFilter];
      } else {
        matchStage.$or = requestedByTextFilter.$or;
      }
    } else if (requestedByUserId) {
      console.log(
        '[QC Approval Controller] Using ObjectId-based filtering for requestedBy (no text fallback needed):',
        requestedByUserId.toString(),
      );
    }

    // QC Entry filters (from qamachineentries) - also check SO
    if (partyName) {
      // Combine with existing $or if present
      const partyNameOr = [
        { 'qcEntryId.party_name': { $regex: partyName, $options: 'i' } },
        { 'machineId.so_id.party_name': { $regex: partyName, $options: 'i' } },
      ];
      if (matchStage.$or) {
        // If $or exists, wrap both in $and
        if (matchStage.$and) {
          matchStage.$and.push({ $or: partyNameOr });
        } else {
          const existingOr = matchStage.$or;
          delete matchStage.$or;
          matchStage.$and = [{ $or: existingOr }, { $or: partyNameOr }];
        }
      } else {
        matchStage.$or = partyNameOr;
      }
    }

    if (location) {
      matchStage['qcEntryId.location'] = {
        $regex: location,
        $options: 'i',
      };
    }

    if (mobileNumber) {
      // Combine with existing $or if present
      const mobileNumberOr = [
        { 'qcEntryId.mobile_number': { $regex: mobileNumber, $options: 'i' } },
        {
          'machineId.so_id.mobile_number': {
            $regex: mobileNumber,
            $options: 'i',
          },
        },
      ];
      if (matchStage.$or) {
        // If $or exists, wrap both in $and
        if (matchStage.$and) {
          matchStage.$and.push({ $or: mobileNumberOr });
        } else {
          const existingOr = matchStage.$or;
          delete matchStage.$or;
          matchStage.$and = [{ $or: existingOr }, { $or: mobileNumberOr }];
        }
      } else {
        matchStage.$or = mobileNumberOr;
      }
    }

    // Date filters for dispatch_date
    if (dispatchDateFrom || dispatchDateTo) {
      matchStage['qcEntryId.dispatch_date'] = {};
      if (dispatchDateFrom) {
        matchStage['qcEntryId.dispatch_date'].$gte = new Date(
          dispatchDateFrom as string,
        );
      }
      if (dispatchDateTo) {
        matchStage['qcEntryId.dispatch_date'].$lte = new Date(
          dispatchDateTo as string,
        );
      }
    }

    // Date filters for qc_date
    if (qcDateFrom || qcDateTo) {
      matchStage['qcEntryId.qc_date'] = {};
      if (qcDateFrom) {
        matchStage['qcEntryId.qc_date'].$gte = new Date(qcDateFrom as string);
      }
      if (qcDateTo) {
        matchStage['qcEntryId.qc_date'].$lte = new Date(qcDateTo as string);
      }
    }

    // Date filters for inspectionDate
    if (inspectionDateFrom || inspectionDateTo) {
      matchStage['qcEntryId.inspectionDate'] = {};
      if (inspectionDateFrom) {
        matchStage['qcEntryId.inspectionDate'].$gte = new Date(
          inspectionDateFrom as string,
        );
      }
      if (inspectionDateTo) {
        matchStage['qcEntryId.inspectionDate'].$lte = new Date(
          inspectionDateTo as string,
        );
      }
    }

    // Add match stage if there are filters
    // IMPORTANT: This must be AFTER all $lookup and $unwind stages so populated fields are available
    if (Object.keys(matchStage).length > 0) {
      console.log(
        '[QC Approval Controller] Applying match stage:',
        JSON.stringify(matchStage, null, 2),
      );
      pipeline.push({ $match: matchStage });
    } else {
      console.log('[QC Approval Controller] No match stage filters applied');
    }

    // Add sort and pagination
    // IMPORTANT: Order matters - sort first, then skip, then limit, then project
    // Apply limit BEFORE project to ensure we only process the needed records
    pipeline.push({ $sort: sortStage });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });
    pipeline.push({
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
        // documents and qcEntryId are included by default in exclusion projection
      },
    });

    console.log('[QC Approval Controller] Executing aggregation pipeline...');
    console.log(
      '[QC Approval Controller] Pipeline stages count:',
      pipeline.length,
    );

    // Debug: Log first few pipeline stages
    if (pipeline.length > 0) {
      console.log(
        '[QC Approval Controller] First pipeline stage:',
        JSON.stringify(pipeline[0], null, 2),
      );
      if (requestedByUserId) {
        // Find the $match stage with requestedBy filter
        const requestedByMatchStage = pipeline.find(
          (stage: any) =>
            stage.$match &&
            stage.$match.$or &&
            (stage.$match.$or.some((condition: any) => condition.requestedBy) ||
              stage.$match.$or.some((condition: any) => condition.$and)),
        );
        if (requestedByMatchStage) {
          console.log(
            '[QC Approval Controller] RequestedBy filter stage:',
            JSON.stringify(requestedByMatchStage, null, 2),
          );
        }
      }
    }

    const approvals = await QCApproval.aggregate(pipeline);
    console.log(
      '[QC Approval Controller] Aggregation returned',
      approvals.length,
      'approvals',
    );

    // Debug: Log sample approval if any found
    if (approvals.length > 0) {
      const sample = approvals[0];
      console.log('[QC Approval Controller] Sample approval details:');
      console.log('  - _id:', sample._id?.toString());
      console.log('  - requestedBy (raw):', sample.requestedBy?.toString());
      console.log('  - qcEntryId (raw):', sample.qcEntryId?._id?.toString());
      console.log(
        '  - qcEntryId.added_by (raw, before user lookup):',
        sample.qcEntryId?.added_by?.toString(),
      );
    } else if (requestedByUserId) {
      console.warn(
        '[QC Approval Controller] No approvals found for user:',
        requestedByUserId.toString(),
      );
      console.warn(
        '[QC Approval Controller] Checking if any approvals exist in database...',
      );
      // Check if any approvals exist at all
      const totalCount = await QCApproval.countDocuments({
        approvalType: QCApprovalType.MACHINE_QC_ENTRY,
      });
      console.log(
        '[QC Approval Controller] Total MACHINE_QC_ENTRY approvals in database:',
        totalCount,
      );
      // Check if any approvals have this requestedBy
      const requestedByCount = await QCApproval.countDocuments({
        approvalType: QCApprovalType.MACHINE_QC_ENTRY,
        requestedBy: requestedByUserId,
      });
      console.log(
        '[QC Approval Controller] Approvals with requestedBy =',
        requestedByUserId.toString(),
        ':',
        requestedByCount,
      );

      // Also check QC entries with this added_by
      const qcEntriesWithAddedBy = await QAMachineEntry.countDocuments({
        added_by: requestedByUserId,
      });
      console.log(
        '[QC Approval Controller] QC entries with added_by =',
        requestedByUserId.toString(),
        ':',
        qcEntriesWithAddedBy,
      );

      // Check approvals that reference these QC entries
      if (qcEntriesWithAddedBy > 0) {
        const qcEntryIds = await QAMachineEntry.find({
          added_by: requestedByUserId,
        })
          .select('_id')
          .lean();
        const qcEntryIdArray = qcEntryIds.map((e: any) => e._id);
        const approvalsWithQCEntry = await QCApproval.countDocuments({
          approvalType: QCApprovalType.MACHINE_QC_ENTRY,
          qcEntryId: { $in: qcEntryIdArray },
        });
        console.log(
          '[QC Approval Controller] Approvals referencing QC entries with added_by =',
          requestedByUserId.toString(),
          ':',
          approvalsWithQCEntry,
        );
      }
    }

    // Final safety check - ensure we never return more than the limit
    // This handles edge cases where aggregation might return unexpected results
    const limitedApprovals =
      approvals.length > limitNum ? approvals.slice(0, limitNum) : approvals;

    if (approvals.length > limitNum) {
      console.warn(
        `⚠️ Aggregation returned ${approvals.length} records but limit is ${limitNum}. Limiting to ${limitNum}.`,
      );
    }

    console.log(
      '[QC Approval Controller] Final approvals count:',
      limitedApprovals.length,
    );

    if (limitedApprovals.length > 0) {
      console.log('[QC Approval Controller] Sample approval (first):', {
        _id: limitedApprovals[0]._id?.toString(),
        status: limitedApprovals[0].status,
        approvalType: limitedApprovals[0].approvalType,
        machineId: limitedApprovals[0].machineId?._id?.toString(),
        requestedBy: limitedApprovals[0].requestedBy
          ? {
              _id: limitedApprovals[0].requestedBy._id?.toString(),
              username: limitedApprovals[0].requestedBy.username,
              name: limitedApprovals[0].requestedBy.name,
              email: limitedApprovals[0].requestedBy.email,
            }
          : null,
        qcEntryId: limitedApprovals[0].qcEntryId?._id?.toString(),
      });
    } else {
      console.warn(
        '[QC Approval Controller] No approvals returned from aggregation!',
      );
      console.warn('[QC Approval Controller] This might indicate:');
      console.warn('  1. No approvals exist in database');
      console.warn('  2. Filters are too restrictive');
      console.warn(
        '  3. requestedBy filter username does not match any approval',
      );

      // If requestedBy filter was applied, log what we're searching for
      if (requestedBy) {
        console.warn(
          '[QC Approval Controller] requestedBy filter was:',
          requestedBy,
        );
        console.warn(
          '[QC Approval Controller] Searching for username/name/email matching:',
          requestedBy,
        );
      }
    }

    // Get total count with same filters
    // Build count pipeline (same structure as main pipeline but without sort/pagination)
    const countPipeline: any[] = [];

    // IMPORTANT: Filter by approvalType first (only MACHINE_QC_ENTRY for QC dashboard)
    // This ensures count matches the filtered results
    countPipeline.push({
      $match: {
        approvalType:
          matchStage.approvalType || QCApprovalType.MACHINE_QC_ENTRY,
      },
    });

    // Note: We're NOT filtering by requestedBy before lookups anymore
    // Instead, we'll filter by qcEntryId.added_by after the qcEntryId lookup
    // This ensures we use the actual QC entry creator from qamachineentries
    console.log(
      '[QC Approval Controller] Count pipeline will filter by qcEntryId.added_by after qcEntryId lookup',
    );

    countPipeline.push(
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
      // Lookup SO (Sales Order) - machines now reference SO instead of direct category
      {
        $lookup: {
          from: 'sos',
          localField: 'machineId.so_id',
          foreignField: '_id',
          as: 'machineId.so_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.so_id',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // Filter by category _id after SO lookup (if category is ObjectId)
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category as string)) {
        countPipeline.push({
          $match: {
            'machineId.so_id.category_id': new mongoose.Types.ObjectId(
              category as string,
            ),
          },
        });
      }
    }

    // Continue with lookups for count - SO's category and subcategory
    countPipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'machineId.so_id.category_id',
          foreignField: '_id',
          as: 'machineId.so_id.category_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.so_id.category_id',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'machineId.subcategory_id',
          foreignField: '_id',
          as: 'machineId.subcategory_id',
        },
      },
      {
        $unwind: {
          path: '$machineId.subcategory_id',
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
        $unwind: {
          path: '$requestedBy',
          preserveNullAndEmptyArrays: true, // Don't drop documents if requestedBy lookup fails
        },
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
      {
        $lookup: {
          from: 'qamachineentries',
          localField: 'qcEntryId',
          foreignField: '_id',
          as: 'qcEntryId',
        },
      },
      {
        $unwind: {
          path: '$qcEntryId',
          preserveNullAndEmptyArrays: true,
        },
      },
    );

    // IMPORTANT: For count pipeline, add the same requestedByUserId filter
    // This matches EITHER approval.requestedBy OR qcEntryId.added_by (raw ObjectId field)
    if (requestedByUserId) {
      console.log(
        '[QC Approval Controller] Adding requestedBy filter to count pipeline:',
        requestedByUserId.toString(),
      );
      countPipeline.push({
        $match: {
          $or: [
            { requestedBy: requestedByUserId }, // Match approval's requestedBy ObjectId (direct comparison)
            {
              // Match QC entry's added_by ObjectId (raw field) - only if qcEntryId exists
              $and: [
                { qcEntryId: { $exists: true, $ne: null } }, // Ensure qcEntryId exists
                { 'qcEntryId.added_by': requestedByUserId }, // Match QC entry's added_by ObjectId (direct comparison)
              ],
            },
          ],
        },
      });
    }

    // Add match stage for count (after all lookups, including qcEntryId and requestedBy filter)
    if (Object.keys(matchStage).length > 0) {
      console.log(
        '[QC Approval Controller] Adding match stage to count pipeline:',
        JSON.stringify(matchStage, null, 2),
      );
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
          approvals: limitedApprovals,
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
      .populate({
        path: 'machineId',
        select:
          'so_id images metadata location machine_sequence dispatch_date is_approved',
        populate: {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
      })
      .populate('requestedBy', 'username name email')
      .populate('approvedBy', 'username name email')
      .populate('rejectedBy', 'username name email')
      .populate('approvers', 'username name email')
      .populate('qcEntryId', 'files')
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
      .populate({
        path: 'machineId',
        select:
          'so_id images location machine_sequence dispatch_date is_approved',
        populate: {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
      })
      .populate('requestedBy', 'username name email')
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
  console.log('[QC Approval Controller] createQCApprovalForEntry called');
  console.log('[QC Approval Controller] Args:', args);
  console.log(
    '[QC Approval Controller] Requested By User ID:',
    requestedByUserId,
  );

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

  console.log('[QC Approval Controller] Looking up machine:', machineId);
  const machine = await Machine.findById(machineId)
    .populate({
      path: 'so_id',
      select: 'name',
    })
    .lean();
  if (!machine) {
    console.error('[QC Approval Controller] Machine not found:', machineId);
    throw new ApiError(
      'MACHINE_NOT_FOUND',
      404,
      'MACHINE_NOT_FOUND',
      'Machine not found',
    );
  }
  const machineName =
    (machine as any).so_id?.name || machine._id?.toString() || 'Unknown';
  console.log(
    '[QC Approval Controller] Machine found:',
    machineName,
    'is_approved:',
    (machine as any).is_approved,
  );

  if (!(machine as any).is_approved) {
    console.error(
      '[QC Approval Controller] Machine is not approved:',
      machineId,
    );
    throw new ApiError(
      'MACHINE_NOT_APPROVED',
      400,
      'MACHINE_NOT_APPROVED',
      'Machine must be approved before QC approval',
    );
  }

  console.log(
    '[QC Approval Controller] Checking for existing PENDING approval...',
  );
  // Check for existing approval by machineId OR qcEntryId to avoid duplicates
  const existingApproval = await QCApproval.findOne({
    $or: [
      {
        machineId,
        status: QCApprovalStatus.PENDING,
        approvalType: approvalType || QCApprovalType.MACHINE_QC_ENTRY,
      },
      ...(qcEntryId
        ? [
            {
              qcEntryId,
              status: QCApprovalStatus.PENDING,
              approvalType: approvalType || QCApprovalType.MACHINE_QC_ENTRY,
            },
          ]
        : []),
    ],
  });
  if (existingApproval) {
    console.log(
      '[QC Approval Controller] Existing PENDING approval found, returning it:',
      existingApproval._id,
    );
    console.log('[QC Approval Controller] Existing approval details:', {
      _id: existingApproval._id,
      machineId: existingApproval.machineId,
      qcEntryId: existingApproval.qcEntryId,
      requestedBy: existingApproval.requestedBy,
      status: existingApproval.status,
      approvalType: existingApproval.approvalType,
    });
    return existingApproval;
  }
  console.log(
    '[QC Approval Controller] No existing PENDING approval found, creating new one...',
  );

  console.log('[QC Approval Controller] Getting approvers...');
  const approvers = await getQCApprovers();
  console.log('[QC Approval Controller] Approvers found:', approvers.length);

  console.log('[QC Approval Controller] Creating new QC approval...');
  console.log(
    '[QC Approval Controller] IMPORTANT: requestedBy is the QC person who created the QC entry, NOT the machine creator',
  );
  console.log(
    '[QC Approval Controller] requestedByUserId (QC person):',
    requestedByUserId,
  );

  // Ensure requestedByUserId is a proper ObjectId
  const requestedByObjectId = mongoose.Types.ObjectId.isValid(requestedByUserId)
    ? new mongoose.Types.ObjectId(requestedByUserId)
    : requestedByUserId;

  console.log('[QC Approval Controller] Creating approval with requestedBy:', {
    original: requestedByUserId,
    objectId: requestedByObjectId,
    type: typeof requestedByUserId,
  });

  // Verify the user exists
  const user = await User.findById(requestedByObjectId)
    .select('username name email')
    .lean();
  if (!user) {
    console.error(
      '[QC Approval Controller] User not found for requestedBy:',
      requestedByObjectId,
    );
    throw new ApiError(
      'USER_NOT_FOUND',
      404,
      'USER_NOT_FOUND',
      'User not found for requestedBy',
    );
  }
  const userData = user as any;
  console.log('[QC Approval Controller] Verified user for requestedBy:', {
    _id: user._id?.toString(),
    username: userData.username,
    name: userData.name,
    email: userData.email,
  });

  const approval = new QCApproval({
    machineId,
    qcEntryId,
    requestedBy: requestedByObjectId, // This is the QC person who created the QC entry
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

  console.log('[QC Approval Controller] Saving approval to database...');
  await approval.save();
  console.log('[QC Approval Controller] Approval saved successfully!');
  console.log(
    '[QC Approval Controller] Approval ID:',
    approval._id?.toString(),
  );
  console.log('[QC Approval Controller] Approval status:', approval.status);
  console.log('[QC Approval Controller] Approval type:', approval.approvalType);
  console.log(
    '[QC Approval Controller] Requested by (User ID):',
    approval.requestedBy?.toString(),
  );
  console.log(
    '[QC Approval Controller] Machine ID:',
    approval.machineId?.toString(),
  );
  console.log(
    '[QC Approval Controller] QC Entry ID:',
    approval.qcEntryId?.toString(),
  );

  // Verify the approval was saved by fetching it back
  const savedApproval = await QCApproval.findById(approval._id)
    .populate('requestedBy', 'username name email')
    .lean();
  console.log('[QC Approval Controller] Verified saved approval:', {
    _id: savedApproval?._id?.toString(),
    status: savedApproval?.status,
    approvalType: savedApproval?.approvalType,
    machineId: savedApproval?.machineId?.toString(),
    qcEntryId: savedApproval?.qcEntryId?.toString(),
    requestedBy: savedApproval?.requestedBy
      ? {
          _id: (savedApproval.requestedBy as any)?._id?.toString(),
          username: (savedApproval.requestedBy as any)?.username,
          name: (savedApproval.requestedBy as any)?.name,
          email: (savedApproval.requestedBy as any)?.email,
        }
      : null,
  });

  // Also verify the machine's created_by to show the difference
  const machineWithCreator = await Machine.findById(machineId)
    .populate('created_by', 'username name email')
    .lean();
  console.log(
    '[QC Approval Controller] Machine creator (for comparison - NOT used in QC approval):',
    {
      machineId: machineWithCreator?._id?.toString(),
      created_by: machineWithCreator?.created_by
        ? {
            _id: (machineWithCreator.created_by as any)?._id?.toString(),
            username: (machineWithCreator.created_by as any)?.username,
            name: (machineWithCreator.created_by as any)?.name,
            email: (machineWithCreator.created_by as any)?.email,
          }
        : null,
    },
  );
  console.log('[QC Approval Controller] COMPARISON:');
  console.log(
    '[QC Approval Controller]   QC Approval requestedBy (QC person):',
    savedApproval?.requestedBy
      ? (savedApproval.requestedBy as any)?.username
      : 'N/A',
  );
  console.log(
    '[QC Approval Controller]   Machine created_by (technician):',
    machineWithCreator?.created_by
      ? (machineWithCreator.created_by as any)?.username
      : 'N/A',
  );
  console.log('[QC Approval Controller]   These should be DIFFERENT users!');

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

    // Only allow updates if status is PENDING or REJECTED
    // REJECTED records can be updated to resubmit for approval
    if (
      approval.status !== QCApprovalStatus.PENDING &&
      approval.status !== QCApprovalStatus.REJECTED
    ) {
      throw new ApiError(
        'CANNOT_UPDATE_QC_APPROVAL',
        400,
        'CANNOT_UPDATE_QC_APPROVAL',
        'Can only update PENDING or REJECTED QC approvals',
      );
    }

    // If updating a REJECTED approval, reset status to PENDING
    if (approval.status === QCApprovalStatus.REJECTED) {
      approval.status = QCApprovalStatus.PENDING;
      approval.rejectedBy = null as any;
      approval.rejectionReason = null as any;
      approval.approvalDate = null as any;
    }

    // Ensure proposedChanges exists (required field)
    if (
      !approval.proposedChanges ||
      typeof approval.proposedChanges !== 'object'
    ) {
      approval.proposedChanges = {};
    }

    // Preserve existing proposedChanges and update only changed fields
    const proposedChanges: Record<string, unknown> = {
      ...(approval.proposedChanges as Record<string, unknown>),
    };

    // Update proposed changes
    if (updateData['qcNotes'] !== undefined) {
      approval.qcNotes = updateData['qcNotes'];
      proposedChanges['qcNotes'] = updateData['qcNotes'];
    }
    if (updateData['qcFindings'] !== undefined) {
      approval.qcFindings = updateData['qcFindings'];
      proposedChanges['qcFindings'] = updateData['qcFindings'];
    }
    if (updateData['qualityScore'] !== undefined) {
      approval.qualityScore = updateData['qualityScore'];
      proposedChanges['qualityScore'] = updateData['qualityScore'];
    }
    if (updateData['inspectionDate'] !== undefined) {
      if (updateData['inspectionDate']) {
        approval.inspectionDate = new Date(
          updateData['inspectionDate'] as string,
        );
        proposedChanges['inspectionDate'] = updateData['inspectionDate'];
      } else {
        approval.inspectionDate = undefined as any;
        proposedChanges['inspectionDate'] = null;
      }
    }
    if (updateData['nextInspectionDate'] !== undefined) {
      if (updateData['nextInspectionDate']) {
        approval.nextInspectionDate = new Date(
          updateData['nextInspectionDate'] as string,
        );
        proposedChanges['nextInspectionDate'] =
          updateData['nextInspectionDate'];
      } else {
        approval.nextInspectionDate = undefined as any;
        proposedChanges['nextInspectionDate'] = null;
      }
    }
    if (updateData.requestNotes !== undefined) {
      approval.requestNotes = updateData.requestNotes;
      proposedChanges['requestNotes'] = updateData.requestNotes;
    }

    // Set the updated proposedChanges
    approval.proposedChanges = proposedChanges;

    await approval.save();

    const updatedApproval = await QCApproval.findById(approval._id)
      .populate({
        path: 'machineId',
        select:
          'so_id images location machine_sequence dispatch_date is_approved',
        populate: {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
      })
      .populate('requestedBy', 'username name email')
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
    // Extract from validated body (validateRequest middleware validates req.body directly)
    const { approvalId, action, notes } = req.body as {
      approvalId: string;
      action: 'approve' | 'reject';
      notes?: string;
    };
    const userId = (req as any).user?.id;

    console.log('🔵 processQCApprovalAction called:', {
      approvalId,
      action,
      notes,
      userId,
      rawBody: req.body,
    });

    if (!approvalId) {
      console.error('❌ Missing approvalId in request:', {
        body: req.body,
        bodyKeys: Object.keys(req.body || {}),
      });
      throw new ApiError(
        'MISSING_APPROVAL_ID',
        400,
        'MISSING_APPROVAL_ID',
        'Approval ID is required',
      );
    }

    const approval = await QCApproval.findById(approvalId);
    console.log('🔵 Approval lookup result:', {
      found: !!approval,
      approvalId,
      approvalStatus: approval?.status,
      hasProposedChanges: !!approval?.proposedChanges,
    });

    if (!approval) {
      // Try to find by string ID if ObjectId lookup failed
      const allApprovals = await QCApproval.find({})
        .limit(5)
        .select('_id status')
        .lean();
      console.log(
        '🔵 Sample approval IDs in DB:',
        allApprovals.map((a) => ({
          id: a._id?.toString(),
          status: a.status,
        })),
      );

      throw new ApiError(
        'QC_APPROVAL_NOT_FOUND',
        404,
        'QC_APPROVAL_NOT_FOUND',
        `QC approval not found with ID: ${approvalId}`,
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

    // Ensure proposedChanges exists (required field)
    if (!approval.proposedChanges) {
      approval.proposedChanges = {};
    }

    if (action === 'approve') {
      approval.status = QCApprovalStatus.APPROVED;
      approval.approvedBy = userId;
      approval.approvalDate = new Date();
      approval.approverNotes = notes || '';
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
      approval.rejectionReason = notes || '';
      // Mirror dispatch: keep QC entry inactive and set rejection reason
      if (approval.qcEntryId) {
        await QAMachineEntry.findByIdAndUpdate(approval.qcEntryId, {
          is_active: false,
          approval_status: 'REJECTED',
          rejection_reason: notes || '',
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
      .populate({
        path: 'machineId',
        select:
          'so_id images location machine_sequence dispatch_date is_approved',
        populate: {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
      })
      .populate('requestedBy', 'username name email')
      .populate('approvedBy', 'username name email')
      .populate('rejectedBy', 'username name email')
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

    // Ensure proposedChanges exists (required field)
    if (!approval.proposedChanges) {
      approval.proposedChanges = {};
    }

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
      .populate({
        path: 'machineId',
        select:
          'so_id images location machine_sequence dispatch_date is_approved',
        populate: {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
      })
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

    // Allow uploads for PENDING and REJECTED (REJECTED can be updated and resubmitted)
    if (
      approval.status !== QCApprovalStatus.PENDING &&
      approval.status !== QCApprovalStatus.REJECTED
    ) {
      throw new ApiError(
        'CANNOT_UPLOAD_DOCUMENTS',
        400,
        'CANNOT_UPLOAD_DOCUMENTS',
        'Can only upload documents for PENDING or REJECTED QC approvals',
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

    // Allow deletion for PENDING and REJECTED (REJECTED can be updated and resubmitted)
    if (
      approval.status !== QCApprovalStatus.PENDING &&
      approval.status !== QCApprovalStatus.REJECTED
    ) {
      throw new ApiError(
        'CANNOT_DELETE_DOCUMENTS',
        400,
        'CANNOT_DELETE_DOCUMENTS',
        'Can only delete documents from PENDING or REJECTED QC approvals',
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

/**
 * Get search suggestions for autocomplete
 */
export const getSearchSuggestions = asyncHandler(
  async (req: Request, res: Response) => {
    const { field, query } = req.query;

    if (!field || typeof field !== 'string') {
      throw new ApiError(
        'INVALID_FIELD',
        StatusCodes.BAD_REQUEST,
        'INVALID_FIELD',
        'Field parameter is required',
      );
    }

    const searchQuery = query ? String(query).trim() : '';
    const limit = 20; // Limit suggestions to 20

    let suggestions: string[] = [];

    try {
      switch (field) {
        case 'requestedBy': {
          // Get unique usernames, names, and emails from requestedBy
          const pipeline = [
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
              $group: {
                _id: null,
                usernames: { $addToSet: '$requestedBy.username' },
                names: { $addToSet: '$requestedBy.name' },
                emails: { $addToSet: '$requestedBy.email' },
              },
            },
            {
              $project: {
                _id: 0,
                allValues: {
                  $setUnion: ['$usernames', '$names', '$emails'],
                },
              },
            },
          ];

          const result = await QCApproval.aggregate(pipeline);
          const allValues = result[0]?.allValues || [];

          // Filter based on query
          suggestions = allValues
            .filter(
              (val: string) =>
                val && val.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .slice(0, limit);
          break;
        }

        case 'partyName': {
          // Get unique party names from both machine (via SO) and QC entry
          const pipeline = [
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
                from: 'sos',
                localField: 'machineId.so_id',
                foreignField: '_id',
                as: 'machineId.so_id',
              },
            },
            {
              $unwind: {
                path: '$machineId.so_id',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: 'qamachineentries',
                localField: 'qcEntryId',
                foreignField: '_id',
                as: 'qcEntryId',
              },
            },
            {
              $unwind: {
                path: '$qcEntryId',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: null,
                machinePartyNames: {
                  $addToSet: '$machineId.so_id.party_name',
                },
                qcPartyNames: {
                  $addToSet: '$qcEntryId.party_name',
                },
              },
            },
            {
              $project: {
                _id: 0,
                allValues: {
                  $setUnion: ['$machinePartyNames', '$qcPartyNames'],
                },
              },
            },
          ];

          const result = await QCApproval.aggregate(pipeline);
          const allValues = result[0]?.allValues || [];

          // Filter based on query
          suggestions = allValues
            .filter(
              (val: string) =>
                val && val.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .slice(0, limit);
          break;
        }

        case 'location': {
          // Get unique locations from both machine and QC entry
          const pipeline = [
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
                from: 'qamachineentries',
                localField: 'qcEntryId',
                foreignField: '_id',
                as: 'qcEntryId',
              },
            },
            {
              $unwind: {
                path: '$qcEntryId',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: null,
                machineLocations: {
                  $addToSet: '$machineId.location',
                },
                qcLocations: {
                  $addToSet: '$qcEntryId.location',
                },
              },
            },
            {
              $project: {
                _id: 0,
                allValues: {
                  $setUnion: ['$machineLocations', '$qcLocations'],
                },
              },
            },
          ];

          const result = await QCApproval.aggregate(pipeline);
          const allValues = result[0]?.allValues || [];

          // Filter based on query
          suggestions = allValues
            .filter(
              (val: string) =>
                val && val.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .slice(0, limit);
          break;
        }

        default:
          throw new ApiError(
            'INVALID_FIELD',
            StatusCodes.BAD_REQUEST,
            'INVALID_FIELD',
            `Invalid field: ${field}. Supported fields: requestedBy, partyName, location`,
          );
      }

      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { suggestions },
            'Suggestions retrieved successfully',
          ),
        );
    } catch (error: any) {
      throw new ApiError(
        'SUGGESTION_ERROR',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'SUGGESTION_ERROR',
        error.message || 'Failed to retrieve suggestions',
      );
    }
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
  getSearchSuggestions,
};

export default QCApprovalController;
