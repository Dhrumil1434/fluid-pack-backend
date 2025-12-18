import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  MachineApproval,
  IMachineApproval,
  ApprovalType,
  ApprovalStatus,
} from '../../../models/machineApproval.model';
import { ApiError } from '../../../utils/ApiError';
import { User } from '../../../models/user.model';
import { Machine } from '../../../models/machine.model';

export interface CreateApprovalRequestData {
  machineId: string;
  requestedBy: string;
  approvalType: ApprovalType;
  proposedChanges: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  requestNotes?: string;
  approverRoles?: string[]; // optional scoping to approver role ids
}

export interface ApprovalDecisionData {
  approvalId: string;
  approvedBy: string;
  approved: boolean;
  approverNotes?: string;
  rejectionReason?: string;
}

export interface ApprovalFilters {
  status?: ApprovalStatus;
  requestedBy?: string;
  createdBy?: string; // Machine created_by field (username/email)
  approvalType?: ApprovalType;
  machineId?: string;
  machineName?: string; // Machine name filter (searches SO name)
  sequence?: string; // Machine sequence number
  categoryId?: string; // Category filter (via SO)
  dateFrom?: string; // Date range start (ISO string) - approval creation date
  dateTo?: string; // Date range end (ISO string) - approval creation date
  soDateFrom?: string; // SO date range start (ISO string)
  soDateTo?: string; // SO date range end (ISO string)
  poDateFrom?: string; // PO date range start (ISO string)
  poDateTo?: string; // PO date range end (ISO string)
  soNumber?: string; // SO number filter
  poNumber?: string; // PO number filter
  metadataKey?: string; // Metadata key to search
  metadataValue?: string; // Metadata value to search
  search?: string; // General search across multiple fields (requestNotes, SO fields, etc.)
  sortBy?: string; // Sort field (default: createdAt)
  sortOrder?: 'asc' | 'desc'; // Sort order (default: desc)
}

export interface ApprovalListResult {
  approvals: IMachineApproval[];
  total: number;
  pages: number;
}

class MachineApprovalService {
  /**
   * Create an approval request
   */
  static async createApprovalRequest(
    data: CreateApprovalRequestData,
  ): Promise<IMachineApproval> {
    try {
      // Verify machine exists
      const machine = await Machine.findById(data.machineId);
      if (!machine) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.NOT_FOUND,
          'MACHINE_NOT_FOUND',
          'Machine not found',
        );
      }

      // Verify requester exists
      const requester = await User.findById(data.requestedBy);
      if (!requester) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'Requester not found',
        );
      }

      // Check if there's already a pending approval for this machine and action
      const existingApproval = await MachineApproval.findOne({
        machineId: data.machineId,
        approvalType: data.approvalType,
        status: ApprovalStatus.PENDING,
      });

      if (existingApproval) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.CONFLICT,
          'PENDING_APPROVAL_EXISTS',
          'A pending approval request already exists for this machine and action',
        );
      }

      const approvalRequest = new MachineApproval({
        machineId: data.machineId,
        requestedBy: data.requestedBy,
        approvalType: data.approvalType,
        originalData: data.originalData,
        proposedChanges: data.proposedChanges,
        requestNotes: data.requestNotes,
        status: ApprovalStatus.PENDING,
        approverRoles: (data.approverRoles || []).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      });

      await approvalRequest.save();

      // Populate related data
      await approvalRequest.populate([
        {
          path: 'machineId',
          select:
            'so_id dispatch_date machine_sequence metadata location is_approved',
          populate: {
            path: 'so_id',
            select:
              'name category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description slug' },
              { path: 'subcategory_id', select: 'name description slug' },
            ],
          },
        },
        { path: 'requestedBy', select: 'username email' },
      ]);

      return approvalRequest;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CREATE_APPROVAL_REQUEST',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_APPROVAL_ERROR',
        'Failed to create approval request',
      );
    }
  }

  /**
   * Get approval requests with pagination and filters
   * Uses aggregation pipeline for advanced filtering on populated fields
   */
  static async getApprovalRequests(
    page: number = 1,
    limit: number = 10,
    filters: ApprovalFilters = {},
  ): Promise<ApprovalListResult> {
    try {
      const skip = (page - 1) * limit;
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

      // Build aggregation pipeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pipeline: any[] = [
        // Lookup machine (include all fields including machine_sequence)
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
        // Project to include machine_sequence, dispatch_date, images, and documents explicitly
        {
          $addFields: {
            'machineId.machine_sequence': '$machineId.machine_sequence',
            'machineId.dispatch_date': '$machineId.dispatch_date',
            'machineId.images': '$machineId.images',
            'machineId.documents': '$machineId.documents',
          },
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
        // Lookup SO's category
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
        // Lookup SO's subcategory
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
        // Lookup requestedBy user
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
        // Lookup machine's created_by user
        {
          $lookup: {
            from: 'users',
            localField: 'machineId.created_by',
            foreignField: '_id',
            as: 'machineId.created_by',
          },
        },
        {
          $unwind: {
            path: '$machineId.created_by',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup approvedBy user
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
        // Lookup rejectedBy user
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

      // Build match stage for filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchStage: any = {};

      // Basic filters
      if (filters.status) {
        matchStage.status = filters.status;
      }
      if (filters.approvalType) {
        matchStage.approvalType = filters.approvalType;
      }
      if (filters.machineId) {
        matchStage['machineId._id'] = new mongoose.Types.ObjectId(
          filters.machineId,
        );
      }

      // Category filter (only if valid ObjectId string) - now via SO
      if (
        filters.categoryId &&
        typeof filters.categoryId === 'string' &&
        filters.categoryId.trim()
      ) {
        const categoryId = filters.categoryId.trim();
        if (mongoose.Types.ObjectId.isValid(categoryId)) {
          matchStage['machineId.so_id.category_id._id'] =
            new mongoose.Types.ObjectId(categoryId);
        }
      }

      // Sequence filter (only if non-empty string)
      if (
        filters.sequence &&
        typeof filters.sequence === 'string' &&
        filters.sequence.trim()
      ) {
        matchStage['machineId.machine_sequence'] = {
          $regex: filters.sequence.trim(),
          $options: 'i',
        };
      }

      // Machine name filter (searches SO name)
      if (
        filters.machineName &&
        typeof filters.machineName === 'string' &&
        filters.machineName.trim()
      ) {
        matchStage['machineId.so_id.name'] = {
          $regex: filters.machineName.trim(),
          $options: 'i',
        };
      }

      // RequestedBy filter (search by username or email)
      if (
        filters.requestedBy &&
        typeof filters.requestedBy === 'string' &&
        filters.requestedBy.trim()
      ) {
        const requestedByValue = filters.requestedBy.trim();
        // If $or already exists (from metadata), combine them
        if (matchStage.$or) {
          matchStage.$or.push(
            {
              'requestedBy.username': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
            {
              'requestedBy.email': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
          );
        } else {
          matchStage.$or = [
            {
              'requestedBy.username': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
            {
              'requestedBy.email': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
          ];
        }
      }

      // CreatedBy filter (search by machine's created_by username or email)
      if (
        filters.createdBy &&
        typeof filters.createdBy === 'string' &&
        filters.createdBy.trim()
      ) {
        const createdByValue = filters.createdBy.trim();
        // Search in machine's created_by field (populated as user object)
        if (matchStage.$or) {
          matchStage.$or.push(
            {
              'machineId.created_by.username': {
                $regex: createdByValue,
                $options: 'i',
              },
            },
            {
              'machineId.created_by.email': {
                $regex: createdByValue,
                $options: 'i',
              },
            },
          );
        } else {
          matchStage.$or = [
            {
              'machineId.created_by.username': {
                $regex: createdByValue,
                $options: 'i',
              },
            },
            {
              'machineId.created_by.email': {
                $regex: createdByValue,
                $options: 'i',
              },
            },
          ];
        }
      }

      // Date range filter (only if valid date strings) - approval creation date
      if (filters.dateFrom || filters.dateTo) {
        matchStage.createdAt = {};
        if (
          filters.dateFrom &&
          typeof filters.dateFrom === 'string' &&
          filters.dateFrom.trim()
        ) {
          const dateFrom = new Date(filters.dateFrom.trim());
          if (!isNaN(dateFrom.getTime())) {
            matchStage.createdAt.$gte = dateFrom;
          }
        }
        if (
          filters.dateTo &&
          typeof filters.dateTo === 'string' &&
          filters.dateTo.trim()
        ) {
          const endDate = new Date(filters.dateTo.trim());
          if (!isNaN(endDate.getTime())) {
            // Add one day to include the entire end date
            endDate.setHours(23, 59, 59, 999);
            matchStage.createdAt.$lte = endDate;
          }
        }
        // Remove createdAt if no valid dates were set
        if (Object.keys(matchStage.createdAt).length === 0) {
          delete matchStage.createdAt;
        }
      }

      // SO Date range filter (only if valid date strings)
      if (filters.soDateFrom || filters.soDateTo) {
        matchStage['machineId.so_id.so_date'] = {};
        if (
          filters.soDateFrom &&
          typeof filters.soDateFrom === 'string' &&
          filters.soDateFrom.trim()
        ) {
          const soDateFrom = new Date(filters.soDateFrom.trim());
          if (!isNaN(soDateFrom.getTime())) {
            matchStage['machineId.so_id.so_date'].$gte = soDateFrom;
          }
        }
        if (
          filters.soDateTo &&
          typeof filters.soDateTo === 'string' &&
          filters.soDateTo.trim()
        ) {
          const soDateTo = new Date(filters.soDateTo.trim());
          if (!isNaN(soDateTo.getTime())) {
            // Add one day to include the entire end date
            soDateTo.setHours(23, 59, 59, 999);
            matchStage['machineId.so_id.so_date'].$lte = soDateTo;
          }
        }
        // Remove so_date if no valid dates were set
        if (Object.keys(matchStage['machineId.so_id.so_date']).length === 0) {
          delete matchStage['machineId.so_id.so_date'];
        }
      }

      // PO Date range filter (only if valid date strings)
      if (filters.poDateFrom || filters.poDateTo) {
        matchStage['machineId.so_id.po_date'] = {};
        if (
          filters.poDateFrom &&
          typeof filters.poDateFrom === 'string' &&
          filters.poDateFrom.trim()
        ) {
          const poDateFrom = new Date(filters.poDateFrom.trim());
          if (!isNaN(poDateFrom.getTime())) {
            matchStage['machineId.so_id.po_date'].$gte = poDateFrom;
          }
        }
        if (
          filters.poDateTo &&
          typeof filters.poDateTo === 'string' &&
          filters.poDateTo.trim()
        ) {
          const poDateTo = new Date(filters.poDateTo.trim());
          if (!isNaN(poDateTo.getTime())) {
            // Add one day to include the entire end date
            poDateTo.setHours(23, 59, 59, 999);
            matchStage['machineId.so_id.po_date'].$lte = poDateTo;
          }
        }
        // Remove po_date if no valid dates were set
        if (Object.keys(matchStage['machineId.so_id.po_date']).length === 0) {
          delete matchStage['machineId.so_id.po_date'];
        }
      }

      // SO Number filter
      if (
        filters.soNumber &&
        typeof filters.soNumber === 'string' &&
        filters.soNumber.trim()
      ) {
        matchStage['machineId.so_id.so_number'] = {
          $regex: filters.soNumber.trim(),
          $options: 'i',
        };
      }

      // PO Number filter
      if (
        filters.poNumber &&
        typeof filters.poNumber === 'string' &&
        filters.poNumber.trim()
      ) {
        matchStage['machineId.so_id.po_number'] = {
          $regex: filters.poNumber.trim(),
          $options: 'i',
        };
      }

      // Metadata filter (key-value search)
      if (
        filters.metadataKey &&
        typeof filters.metadataKey === 'string' &&
        filters.metadataKey.trim()
      ) {
        const metadataPath = `machineId.metadata.${filters.metadataKey.trim()}`;
        if (
          filters.metadataValue &&
          typeof filters.metadataValue === 'string' &&
          filters.metadataValue.trim()
        ) {
          // Search for specific key-value pair
          matchStage[metadataPath] = {
            $regex: filters.metadataValue.trim(),
            $options: 'i',
          };
        } else {
          // Just check if key exists
          matchStage[metadataPath] = { $exists: true };
        }
      }

      // General search filter - search across multiple fields
      if (
        filters.search &&
        typeof filters.search === 'string' &&
        filters.search.trim()
      ) {
        const searchValue = filters.search.trim();
        const searchConditions: Array<Record<string, unknown>> = [
          // Search in requestNotes
          { requestNotes: { $regex: searchValue, $options: 'i' } },
          // Search in approverNotes
          { approverNotes: { $regex: searchValue, $options: 'i' } },
          // Search in rejectionReason
          { rejectionReason: { $regex: searchValue, $options: 'i' } },
          // Search in requestedBy username/email
          { 'requestedBy.username': { $regex: searchValue, $options: 'i' } },
          { 'requestedBy.email': { $regex: searchValue, $options: 'i' } },
          // Search in machine's created_by username/email
          {
            'machineId.created_by.username': {
              $regex: searchValue,
              $options: 'i',
            },
          },
          {
            'machineId.created_by.email': {
              $regex: searchValue,
              $options: 'i',
            },
          },
          // Search in machine sequence
          {
            'machineId.machine_sequence': {
              $regex: searchValue,
              $options: 'i',
            },
          },
          // Search in SO fields (customer, name, so_number, po_number, party_name, location)
          {
            'machineId.so_id.customer': { $regex: searchValue, $options: 'i' },
          },
          { 'machineId.so_id.name': { $regex: searchValue, $options: 'i' } },
          {
            'machineId.so_id.so_number': {
              $regex: searchValue,
              $options: 'i',
            },
          },
          {
            'machineId.so_id.po_number': {
              $regex: searchValue,
              $options: 'i',
            },
          },
          {
            'machineId.so_id.party_name': {
              $regex: searchValue,
              $options: 'i',
            },
          },
          {
            'machineId.so_id.location': { $regex: searchValue, $options: 'i' },
          },
          {
            'machineId.so_id.mobile_number': {
              $regex: searchValue,
              $options: 'i',
            },
          },
        ];

        // Combine with existing $or if present, or create new $or
        if (matchStage.$or && Array.isArray(matchStage.$or)) {
          matchStage.$or = [...matchStage.$or, ...searchConditions];
        } else {
          matchStage.$or = searchConditions;
        }
      }

      // Add match stage if there are filters
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      // Add sort
      pipeline.push({ $sort: { [sortBy]: sortOrder } });

      // Get total count before pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await MachineApproval.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push({ $skip: skip }, { $limit: limit });

      // Execute aggregation
      const approvals = await MachineApproval.aggregate(pipeline);

      // Manually populate approverRoles if needed (aggregation doesn't populate arrays the same way)
      // For now, we'll leave it as is since approverRoles is not critical for listing

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        approvals: approvals as any[],
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting approval requests:', error);
      throw new ApiError(
        'GET_APPROVAL_REQUESTS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVALS_ERROR',
        'Failed to retrieve approval requests',
      );
    }
  }

  /**
   * Get approval request by ID
   */
  static async getApprovalById(id: string): Promise<IMachineApproval> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'GET_APPROVAL_BY_ID',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_ID',
          'Invalid approval ID format',
        );
      }

      const approval = await MachineApproval.findById(id).populate([
        {
          path: 'machineId',
          select:
            'so_id dispatch_date machine_sequence metadata location is_approved images documents',
          populate: {
            path: 'so_id',
            select:
              'name customer so_number category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description slug' },
              { path: 'subcategory_id', select: 'name description slug' },
            ],
          },
        },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approvedBy', select: 'username email' },
        { path: 'rejectedBy', select: 'username email' },
        { path: 'approverRoles', select: 'name' },
      ]);

      if (!approval) {
        throw new ApiError(
          'GET_APPROVAL_BY_ID',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }

      return approval;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'GET_APPROVAL_BY_ID',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVAL_ERROR',
        'Failed to retrieve approval request',
      );
    }
  }
  /**
   * Update approval request fields while pending
   */
  static async updateApprovalRequest(
    id: string,
    updates: {
      approverRoles?: string[];
      approvalType?: ApprovalType;
      requestNotes?: string;
      proposedChanges?: Record<string, unknown>;
    },
  ): Promise<IMachineApproval> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_ID',
          'Invalid approval ID format',
        );
      }

      const approval = await MachineApproval.findById(id);
      if (!approval) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }
      // Allow editing for PENDING and REJECTED (e.g., adjust approver roles for a resubmission loop)
      if (
        approval.status === ApprovalStatus.APPROVED ||
        approval.status === ApprovalStatus.CANCELLED
      ) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Only pending or rejected approvals can be updated',
        );
      }

      const updateData: Partial<IMachineApproval> =
        {} as Partial<IMachineApproval>;
      if (updates.approverRoles !== undefined) {
        updateData.approverRoles = (updates.approverRoles || []).map(
          (r) => new mongoose.Types.ObjectId(r),
        );
      }
      if (updates.approvalType !== undefined)
        updateData.approvalType = updates.approvalType;
      if (updates.requestNotes !== undefined)
        updateData.requestNotes = updates.requestNotes;
      if (updates.proposedChanges !== undefined)
        updateData.proposedChanges = updates.proposedChanges;

      // Use $set explicitly to avoid merge semantics with arrays
      await MachineApproval.updateOne({ _id: id }, { $set: updateData });
      const updated = await MachineApproval.findById(id).populate([
        {
          path: 'machineId',
          select:
            'so_id dispatch_date machine_sequence metadata location is_approved images documents',
          populate: {
            path: 'so_id',
            select:
              'name customer so_number category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description slug' },
              { path: 'subcategory_id', select: 'name description slug' },
            ],
          },
        },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approverRoles', select: 'name' },
      ]);
      return updated!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'UPDATE_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_APPROVAL_ERROR',
        'Failed to update approval request',
      );
    }
  }

  /**
   * Process approval decision (approve/reject)
   */
  static async processApprovalDecision(
    data: ApprovalDecisionData,
  ): Promise<IMachineApproval> {
    try {
      const approval = await MachineApproval.findById(data.approvalId);
      if (!approval) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Approval request has already been processed',
        );
      }

      // Verify approver exists
      const approver = await User.findById(data.approvedBy);
      if (!approver) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVER_NOT_FOUND',
          'Approver not found',
        );
      }

      // Update approval status
      const updateData: {
        status: ApprovalStatus;
        approverNotes?: string | undefined;
        approvedBy?: string | undefined;
        approvalDate?: Date | undefined;
        rejectedBy?: string | undefined;
        rejectionReason?: string | undefined;
      } = {
        status: data.approved
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.REJECTED,
        approverNotes: data.approverNotes,
      };

      if (data.approved) {
        updateData.approvedBy = data.approvedBy;
        updateData.approvalDate = new Date();
      } else {
        updateData.rejectedBy = data.approvedBy;
        updateData.rejectionReason = data.rejectionReason;
      }

      const updatedApproval = await MachineApproval.findByIdAndUpdate(
        data.approvalId,
        updateData,
        { new: true, runValidators: true },
      ).populate([
        {
          path: 'machineId',
          select:
            'so_id dispatch_date machine_sequence metadata location is_approved images documents',
          populate: {
            path: 'so_id',
            select:
              'name customer so_number category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description slug' },
              { path: 'subcategory_id', select: 'name description slug' },
            ],
          },
        },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approvedBy', select: 'username email' },
        { path: 'rejectedBy', select: 'username email' },
      ]);

      // When an approval is accepted, reflect it on the machine document
      if (data.approved) {
        try {
          await Machine.findByIdAndUpdate(
            approval.machineId,
            { is_approved: true, updatedAt: new Date() },
            { new: true },
          );
        } catch {
          // Do not fail the approval process if machine update fails; log and continue
          // You may replace with a proper logger

          throw new ApiError(
            'PROCESS_APPROVAL',
            StatusCodes.INTERNAL_SERVER_ERROR,
            'PROCESS_APPROVAL_ERROR',
            'Failed to update machine is_approved flag',
          );
        }
      }

      return updatedApproval!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'PROCESS_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PROCESS_APPROVAL_ERROR',
        'Failed to process approval decision',
      );
    }
  }

  /**
   * Get user's approval requests
   */
  static async getUserApprovalRequests(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ApprovalListResult> {
    return this.getApprovalRequests(page, limit, { requestedBy: userId });
  }

  /**
   * Get pending approvals for approvers
   * Now uses getApprovalRequests with enhanced filters
   */
  static async getPendingApprovals(
    page: number = 1,
    limit: number = 10,
    _approverRoleId?: string, // Handled in controller, not used here
    additionalFilters?: Partial<ApprovalFilters>,
  ): Promise<ApprovalListResult> {
    const filters: ApprovalFilters = {
      status: ApprovalStatus.PENDING,
      ...additionalFilters,
    };
    // Note: approverRoleId filtering is handled in the controller
    // as it requires post-processing or additional aggregation stages
    return this.getApprovalRequests(page, limit, filters);
  }

  /**
   * Cancel an approval request (only by requester)
   */
  static async cancelApprovalRequest(
    approvalId: string,
    userId: string,
  ): Promise<IMachineApproval> {
    try {
      const approval = await MachineApproval.findById(approvalId);
      if (!approval) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }

      if (approval.requestedBy.toString() !== userId) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.FORBIDDEN,
          'NOT_AUTHORIZED',
          'Only the requester can cancel the approval request',
        );
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Cannot cancel already processed approval request',
        );
      }

      const updatedApproval = await MachineApproval.findByIdAndUpdate(
        approvalId,
        { status: ApprovalStatus.CANCELLED },
        { new: true, runValidators: true },
      ).populate([
        {
          path: 'machineId',
          select:
            'so_id dispatch_date machine_sequence metadata location is_approved',
          populate: {
            path: 'so_id',
            select:
              'name category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description slug' },
              { path: 'subcategory_id', select: 'name description slug' },
            ],
          },
        },
        { path: 'requestedBy', select: 'username email' },
      ]);

      return updatedApproval!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CANCEL_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CANCEL_APPROVAL_ERROR',
        'Failed to cancel approval request',
      );
    }
  }

  /**
   * Get approval statistics
   */
  static async getApprovalStatistics(): Promise<{
    totalPending: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    approvalsByType: Array<{ _id: string; count: number }>;
    averageProcessingTime: number;
    overdueApprovals: number;
  }> {
    try {
      const totalPending = await MachineApproval.countDocuments({
        status: 'pending',
      });
      const highPriority = await MachineApproval.countDocuments({
        status: 'pending',
        priority: 'high',
      });
      const mediumPriority = await MachineApproval.countDocuments({
        status: 'pending',
        priority: 'medium',
      });
      const lowPriority = await MachineApproval.countDocuments({
        status: 'pending',
        priority: 'low',
      });

      // Get approvals by type
      const approvalsByType = await MachineApproval.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get average processing time
      const processedApprovals = await MachineApproval.find({
        status: { $in: ['approved', 'rejected'] },
        approvalDate: { $exists: true },
      });

      let averageProcessingTime = 0;
      if (processedApprovals.length > 0) {
        const totalTime = processedApprovals.reduce((sum, approval) => {
          if (approval.approvalDate && approval.createdAt) {
            const processingTime =
              approval.approvalDate.getTime() - approval.createdAt.getTime();
            return sum + processingTime;
          }
          return sum;
        }, 0);
        averageProcessingTime =
          totalTime / processedApprovals.length / (1000 * 60 * 60); // Convert to hours
      }

      // Get overdue approvals (pending for more than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const overdueApprovals = await MachineApproval.countDocuments({
        status: 'pending',
        createdAt: { $lt: sevenDaysAgo },
      });

      return {
        totalPending,
        highPriority,
        mediumPriority,
        lowPriority,
        approvalsByType,
        averageProcessingTime,
        overdueApprovals,
      };
    } catch {
      throw new ApiError(
        'GET_APPROVAL_STATISTICS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVAL_STATISTICS_ERROR',
        'Failed to retrieve approval statistics',
      );
    }
  }
}

export default MachineApprovalService;
