import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  QAMachineEntry,
  IQAMachineEntry,
} from '../../../models/qcMachine.model';
import { Machine } from '../../../models/machine.model';
import { User } from '../../../models/user.model';
import { ApiError } from '../../../utils/ApiError';

export interface CreateQAMachineEntryData {
  machine_id: string;
  added_by: string;
  report_link?: string;
  files?: string[];
  metadata?: Record<string, unknown>;
  is_active?: boolean;
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
}

export interface UpdateQAMachineEntryData {
  report_link?: string;
  files?: string[];
  metadata?: Record<string, unknown>;
  is_active?: boolean;
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
}

export interface QAMachineFilters {
  machine_id?: string;
  added_by?: string;
  search?: string;
  is_active?: boolean;
  created_from?: string;
  created_to?: string;
}

export interface QAMachineListResult {
  entries: IQAMachineEntry[];
  total: number;
  pages: number;
}

class QCMachineService {
  /**
   * Create a new QA machine entry
   */
  static async create(
    data: CreateQAMachineEntryData,
  ): Promise<IQAMachineEntry> {
    try {
      // Verify machine exists
      const machine = await Machine.findById(data.machine_id);
      if (!machine) {
        throw new ApiError(
          'CREATE_QA_MACHINE_ENTRY',
          StatusCodes.NOT_FOUND,
          'MACHINE_NOT_FOUND',
          'Machine not found',
        );
      }

      // Verify user exists
      const user = await User.findById(data.added_by);
      if (!user) {
        throw new ApiError(
          'CREATE_QA_MACHINE_ENTRY',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'User not found',
        );
      }

      const qaEntry = new QAMachineEntry({
        machine_id: data.machine_id,
        added_by: data.added_by,
        report_link: data.report_link,
        files: data.files || [],
        metadata: data.metadata || {},
        is_active: data.is_active ?? false,
        approval_status: data.approval_status || 'PENDING',
        rejection_reason: data.rejection_reason,
      });

      await qaEntry.save();

      // Populate related data
      await qaEntry.populate([
        { path: 'machine_id', select: 'name category_id' },
        { path: 'added_by', select: 'username email' },
      ]);

      return qaEntry;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CREATE_QC_MACHINE_ENTRY',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_QC_ENTRY_ERROR',
        'Failed to create QC machine entry',
      );
    }
  }

  /**
   * Get QA machine entries with pagination and filters
   */
  static async getAll(
    page: number = 1,
    limit: number = 10,
    filters: QAMachineFilters = {},
  ): Promise<QAMachineListResult> {
    try {
      const skip = (page - 1) * limit;
      const query: Record<string, unknown> = {};

      // Apply filters
      if (filters.machine_id) query['machine_id'] = filters.machine_id;
      if (filters.added_by) query['added_by'] = filters.added_by;
      if (typeof filters.is_active === 'boolean')
        query['is_active'] = filters.is_active;

      if (filters.created_from || filters.created_to) {
        const createdAt: { $gte?: Date; $lte?: Date } = {};
        if (filters.created_from)
          createdAt.$gte = new Date(filters.created_from);
        if (filters.created_to) createdAt.$lte = new Date(filters.created_to);
        query['createdAt'] = createdAt;
      }

      // Free-text search across machine name, user, and report_link
      const pipeline: mongoose.PipelineStage[] = [
        { $match: query },
        {
          $lookup: {
            from: 'machines',
            localField: 'machine_id',
            foreignField: '_id',
            as: 'machine_id',
          },
        },
        { $unwind: '$machine_id' },
        {
          $lookup: {
            from: 'users',
            localField: 'added_by',
            foreignField: '_id',
            as: 'added_by',
          },
        },
        { $unwind: '$added_by' },
      ];

      if (filters.search) {
        pipeline.push({
          $match: {
            $or: [
              { 'machine_id.name': { $regex: filters.search, $options: 'i' } },
              {
                'added_by.username': { $regex: filters.search, $options: 'i' },
              },
              { report_link: { $regex: filters.search, $options: 'i' } },
            ],
          },
        } as mongoose.PipelineStage);
      }

      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      );

      const [entries, countAgg] = await Promise.all([
        QAMachineEntry.aggregate(pipeline),
        QAMachineEntry.aggregate([
          ...pipeline.filter(
            (st) => !('$skip' in st) && !('$limit' in st) && !('$sort' in st),
          ),
          { $count: 'total' },
        ] as mongoose.PipelineStage[]),
      ]);

      const total = countAgg.length ? countAgg[0].total : 0;

      return {
        entries,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch {
      throw new ApiError(
        'GET_QA_MACHINE_ENTRIES',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_QA_ENTRIES_ERROR',
        'Failed to retrieve QA machine entries',
      );
    }
  }

  /**
   * Get QA machine entry by ID
   */
  static async getById(id: string): Promise<IQAMachineEntry> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'GET_QA_MACHINE_ENTRY_BY_ID',
          StatusCodes.BAD_REQUEST,
          'INVALID_QA_ENTRY_ID',
          'Invalid QA entry ID format',
        );
      }

      const qaEntry = await QAMachineEntry.findById(id).populate([
        { path: 'machine_id', select: 'name category_id' },
        { path: 'added_by', select: 'username email' },
      ]);

      if (!qaEntry) {
        throw new ApiError(
          'GET_QA_MACHINE_ENTRY_BY_ID',
          StatusCodes.NOT_FOUND,
          'QA_ENTRY_NOT_FOUND',
          'QA machine entry not found',
        );
      }

      return qaEntry;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'GET_QA_MACHINE_ENTRY_BY_ID',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_QA_ENTRY_ERROR',
        'Failed to retrieve QA machine entry',
      );
    }
  }

  /**
   * Update QA machine entry
   */
  static async update(
    id: string,
    data: UpdateQAMachineEntryData,
  ): Promise<IQAMachineEntry> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY',
          StatusCodes.BAD_REQUEST,
          'INVALID_QA_ENTRY_ID',
          'Invalid QA entry ID format',
        );
      }

      const qaEntry = await QAMachineEntry.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
      }).populate([
        { path: 'machine_id', select: 'name category_id' },
        { path: 'added_by', select: 'username email' },
      ]);

      if (!qaEntry) {
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY',
          StatusCodes.NOT_FOUND,
          'QA_ENTRY_NOT_FOUND',
          'QA machine entry not found',
        );
      }

      return qaEntry;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'UPDATE_QA_MACHINE_ENTRY',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_QA_ENTRY_ERROR',
        'Failed to update QA machine entry',
      );
    }
  }

  /**
   * Delete QA machine entry
   */
  static async delete(id: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'DELETE_QA_MACHINE_ENTRY',
          StatusCodes.BAD_REQUEST,
          'INVALID_QA_ENTRY_ID',
          'Invalid QA entry ID format',
        );
      }

      const qaEntry = await QAMachineEntry.findByIdAndDelete(id);

      if (!qaEntry) {
        throw new ApiError(
          'DELETE_QA_MACHINE_ENTRY',
          StatusCodes.NOT_FOUND,
          'QA_ENTRY_NOT_FOUND',
          'QA machine entry not found',
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'DELETE_QA_MACHINE_ENTRY',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'DELETE_QA_ENTRY_ERROR',
        'Failed to delete QA machine entry',
      );
    }
  }

  /**
   * Get QA entries by machine ID
   */
  static async getByMachineId(
    machineId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<QAMachineListResult> {
    try {
      if (!mongoose.Types.ObjectId.isValid(machineId)) {
        throw new ApiError(
          'GET_QA_ENTRIES_BY_MACHINE',
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const skip = (page - 1) * limit;

      const [entries, total] = await Promise.all([
        QAMachineEntry.find({ machine_id: machineId })
          .populate([
            { path: 'machine_id', select: 'name category_id' },
            { path: 'added_by', select: 'username email' },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        QAMachineEntry.countDocuments({ machine_id: machineId }),
      ]);

      return {
        entries,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'GET_QA_ENTRIES_BY_MACHINE',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_QA_ENTRIES_ERROR',
        'Failed to retrieve QA entries for machine',
      );
    }
  }

  /**
   * Get QA entries by user ID
   */
  static async getByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<QAMachineListResult> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(
          'GET_QA_ENTRIES_BY_USER',
          StatusCodes.BAD_REQUEST,
          'INVALID_USER_ID',
          'Invalid user ID format',
        );
      }

      const skip = (page - 1) * limit;

      const [entries, total] = await Promise.all([
        QAMachineEntry.find({ added_by: userId })
          .populate([
            { path: 'machine_id', select: 'name category_id' },
            { path: 'added_by', select: 'username email' },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        QAMachineEntry.countDocuments({ added_by: userId }),
      ]);

      return {
        entries,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'GET_QA_ENTRIES_BY_USER',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_QA_ENTRIES_ERROR',
        'Failed to retrieve QA entries for user',
      );
    }
  }

  /**
   * Check if QA entry exists
   */
  static async exists(id: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }
      const qaEntry = await QAMachineEntry.findById(id);
      return !!qaEntry;
    } catch {
      return false;
    }
  }

  /**
   * Get QA statistics
   */
  static async getQAStatistics(): Promise<{
    totalQAEntries: number;
    recentEntries: number;
    qaEntriesByMachine: Array<{ _id: string; count: number }>;
    entriesByUser: Array<{ _id: string; count: number }>;
  }> {
    try {
      const totalQAEntries = await QAMachineEntry.countDocuments();

      // Get QA entries by machine
      const qaEntriesByMachine = await QAMachineEntry.aggregate([
        {
          $lookup: {
            from: 'machines',
            localField: 'machine_id',
            foreignField: '_id',
            as: 'machine',
          },
        },
        {
          $unwind: '$machine',
        },
        {
          $group: {
            _id: '$machine.name',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get recent entries (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentEntries = await QAMachineEntry.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      // Get entries by user
      const entriesByUser = await QAMachineEntry.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'added_by',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $group: {
            _id: '$user.username',
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        totalQAEntries,
        recentEntries,
        qaEntriesByMachine,
        entriesByUser,
      };
    } catch {
      throw new ApiError(
        'GET_QA_STATISTICS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_QA_STATISTICS_ERROR',
        'Failed to retrieve QA statistics',
      );
    }
  }
}

export default QCMachineService;
