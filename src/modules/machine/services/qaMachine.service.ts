import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  QAMachineEntry,
  IQAMachineEntry,
} from '../../../models/qaMachine.model';
import { Machine, IMachine } from '../../../models/machine.model';
import { User, IUser } from '../../../models/user.model';
import { ApiError } from '../../../utils/ApiError';

export interface CreateQAMachineEntryData {
  machine_id: string;
  added_by: string;
  report_link: string;
  files?: string[];
}

export interface UpdateQAMachineEntryData {
  report_link?: string;
  files?: string[];
}

export interface QAMachineFilters {
  machine_id?: string;
  added_by?: string;
  search?: string;
}

export interface QAMachineListResult {
  entries: IQAMachineEntry[];
  total: number;
  pages: number;
}

class QAMachineService {
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
        'CREATE_QA_MACHINE_ENTRY',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_QA_ENTRY_ERROR',
        'Failed to create QA machine entry',
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

      const [entries, total] = await Promise.all([
        QAMachineEntry.find(query)
          .populate([
            { path: 'machine_id', select: 'name category_id' },
            { path: 'added_by', select: 'username email' },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        QAMachineEntry.countDocuments(query),
      ]);

      return {
        entries,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
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
    } catch (error) {
      return false;
    }
  }
}

export default QAMachineService;
