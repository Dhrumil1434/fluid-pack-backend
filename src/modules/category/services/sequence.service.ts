import mongoose from 'mongoose';
import {
  Category,
  SequenceManagement,
  ICategory,
  ISequenceManagement,
} from '../../../models/category.model';
import { Machine } from '../../../models/machine.model';
import { ApiError } from '../../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import { ERROR_MESSAGES } from '../category.error.constants';

/**
 * Interface for sequence generation data
 */
export interface SequenceGenerationData {
  categoryId: string;
  subcategoryId?: string;
}

/**
 * Interface for sequence configuration data
 */
export interface CreateSequenceConfigData {
  categoryId: string;
  subcategoryId?: string;
  sequencePrefix: string;
  startingNumber: number;
  format: string;
  createdBy: string;
}

/**
 * Interface for updating sequence configuration
 */
export interface UpdateSequenceConfigData {
  sequencePrefix?: string;
  startingNumber?: number;
  format?: string;
  isActive?: boolean;
  updatedBy: string;
}

/**
 * Interface for sequence reset data
 */
export interface SequenceResetData {
  newStartingNumber: number;
  updatedBy: string;
}

/**
 * SequenceService handles all sequence-related operations
 */
class SequenceService {
  /**
   * Generate next sequence number for a category/subcategory combination
   */
  static async generateSequence(data: SequenceGenerationData): Promise<string> {
    try {
      const { categoryId, subcategoryId } = data;

      // Validate category ID
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      // Validate subcategory ID if provided
      if (subcategoryId && !mongoose.Types.ObjectId.isValid(subcategoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      // Find sequence configuration
      // Build query with proper null handling for subcategory
      const query: {
        category_id: string;
        subcategory_id: string | null;
        is_active: boolean;
      } = {
        category_id: categoryId,
        is_active: true,
        subcategory_id:
          subcategoryId && subcategoryId.trim() !== '' ? subcategoryId : null,
      };

      let sequenceConfig = await SequenceManagement.findOne(query);

      // If no exact match found and subcategory was provided,
      // try to find a category-only config (subcategory_id = null) as fallback
      // This allows using a main category sequence config for machines with subcategories
      if (!sequenceConfig && subcategoryId && subcategoryId.trim() !== '') {
        const fallbackQuery = {
          category_id: categoryId,
          is_active: true,
          subcategory_id: null,
        };
        sequenceConfig = await SequenceManagement.findOne(fallbackQuery);
      }

      if (!sequenceConfig) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.message,
        );
      }

      // Get category and subcategory information
      const category = await Category.findById(categoryId).select('name slug');
      if (!category) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      let subcategory: ICategory | null = null;
      if (subcategoryId && subcategoryId.trim() !== '') {
        subcategory =
          await Category.findById(subcategoryId).select('name slug');
        if (!subcategory) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
            StatusCodes.NOT_FOUND,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
          );
        }
      }

      // Generate next sequence number and ensure uniqueness
      let nextSequence = sequenceConfig.current_sequence + 1;
      let formattedSequence = '';
      let attempts = 0;
      const maxAttempts = 1000; // Prevent infinite loops
      let sequenceExists = true;

      // Keep generating until we find a unique sequence or hit max attempts
      while (sequenceExists && attempts < maxAttempts) {
        formattedSequence = this.formatSequence(
          sequenceConfig.format,
          category,
          subcategory,
          nextSequence,
        );

        // Check if this sequence already exists in the database
        const trimmedSequence = formattedSequence.trim();
        const existingMachine = await Machine.findOne({
          machine_sequence: trimmedSequence,
          deletedAt: null,
        });

        if (!existingMachine) {
          // Sequence is unique, break out of loop
          sequenceExists = false;
        } else {
          // Sequence exists, try next number
          nextSequence++;
          attempts++;
        }
      }

      if (attempts >= maxAttempts) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
          StatusCodes.INTERNAL_SERVER_ERROR,
          'SEQUENCE_GENERATION_FAILED',
          'Unable to generate a unique sequence after multiple attempts. Please check for duplicate sequences in the database.',
        );
      }

      // Update current sequence atomically
      await SequenceManagement.findByIdAndUpdate(
        sequenceConfig._id,
        {
          current_sequence: nextSequence,
          updated_at: new Date(),
        },
        { new: true },
      );

      return formattedSequence;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.GENERATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_GENERATION_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_GENERATION_ERROR.message,
      );
    }
  }

  /**
   * Create sequence configuration
   */
  static async createSequenceConfig(
    data: CreateSequenceConfigData,
  ): Promise<ISequenceManagement> {
    try {
      const {
        categoryId,
        subcategoryId,
        sequencePrefix,
        startingNumber,
        format,
        createdBy,
      } = data;

      // Validate category ID
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      // Validate subcategory ID if provided
      if (subcategoryId && !mongoose.Types.ObjectId.isValid(subcategoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      // Validate format
      if (!format.includes('{category}') || !format.includes('{sequence}')) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_FORMAT.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_FORMAT.message,
        );
      }

      // Validate starting number
      if (startingNumber < 1) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_STARTING_NUMBER.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_STARTING_NUMBER.message,
        );
      }

      // Check if category exists
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      // Check if subcategory exists (if provided)
      if (subcategoryId) {
        const subcategory = await Category.findById(subcategoryId);
        if (!subcategory) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
            StatusCodes.NOT_FOUND,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
          );
        }
      }

      // Check for duplicate configuration
      const existingConfig = await SequenceManagement.findOne({
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
      });

      if (existingConfig) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.CONFLICT,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.DUPLICATE_CONFIG.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.DUPLICATE_CONFIG.message,
        );
      }

      // Create sequence configuration
      const sequenceConfig = new SequenceManagement({
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        sequence_prefix: sequencePrefix.toUpperCase(),
        current_sequence: startingNumber - 1, // Will be incremented on first use
        starting_number: startingNumber,
        format,
        is_active: true,
        created_by: createdBy,
      });

      await sequenceConfig.save();
      return sequenceConfig;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.CREATE_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.CREATE_ERROR.message,
      );
    }
  }

  /**
   * Update sequence configuration
   */
  static async updateSequenceConfig(
    configId: string,
    data: UpdateSequenceConfigData,
  ): Promise<ISequenceManagement> {
    try {
      if (!mongoose.Types.ObjectId.isValid(configId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      const sequenceConfig = await SequenceManagement.findById(configId);
      if (!sequenceConfig) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.message,
        );
      }

      // Validate format if provided
      if (
        data.format &&
        (!data.format.includes('{category}') ||
          !data.format.includes('{sequence}'))
      ) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_FORMAT.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_FORMAT.message,
        );
      }

      // Validate starting number if provided
      if (data.startingNumber && data.startingNumber < 1) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_STARTING_NUMBER.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_STARTING_NUMBER.message,
        );
      }

      // Update configuration
      const updateData: Record<string, unknown> = {
        updated_by: data.updatedBy,
        updated_at: new Date(),
      };

      if (data.sequencePrefix)
        updateData['sequence_prefix'] = data.sequencePrefix.toUpperCase();
      if (data.startingNumber !== undefined) {
        updateData['starting_number'] = data.startingNumber;
        updateData['current_sequence'] = data.startingNumber - 1; // Reset current sequence
      }
      if (data.format) updateData['format'] = data.format;
      if (data.isActive !== undefined) updateData['is_active'] = data.isActive;

      const updatedConfig = await SequenceManagement.findByIdAndUpdate(
        configId,
        updateData,
        { new: true },
      );

      return updatedConfig!;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.UPDATE_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.UPDATE_ERROR.message,
      );
    }
  }

  /**
   * Reset sequence number
   */
  static async resetSequence(
    configId: string,
    data: SequenceResetData,
  ): Promise<ISequenceManagement> {
    try {
      if (!mongoose.Types.ObjectId.isValid(configId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.RESET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      if (data.newStartingNumber < 1) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.RESET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_STARTING_NUMBER.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.INVALID_STARTING_NUMBER.message,
        );
      }

      const sequenceConfig = await SequenceManagement.findByIdAndUpdate(
        configId,
        {
          current_sequence: data.newStartingNumber - 1,
          starting_number: data.newStartingNumber,
          updated_by: data.updatedBy,
          updated_at: new Date(),
        },
        { new: true },
      );

      if (!sequenceConfig) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.RESET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.message,
        );
      }

      return sequenceConfig;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.RESET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_RESET_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_RESET_ERROR.message,
      );
    }
  }

  /**
   * Get sequence configuration by category and subcategory
   */
  static async getSequenceConfig(
    categoryId: string,
    subcategoryId?: string,
  ): Promise<ISequenceManagement | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      if (subcategoryId && !mongoose.Types.ObjectId.isValid(subcategoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      const sequenceConfig = await SequenceManagement.findOne({
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
      })
        .populate('category_id', 'name slug')
        .populate('subcategory_id', 'name slug')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email');

      return sequenceConfig;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ERROR.message,
      );
    }
  }

  /**
   * Get all sequence configurations
   */
  static async getAllSequenceConfigs(): Promise<ISequenceManagement[]> {
    try {
      const sequenceConfigs = await SequenceManagement.find()
        .populate('category_id', 'name slug')
        .populate('subcategory_id', 'name slug')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email')
        .sort({ created_at: -1 });

      return sequenceConfigs;
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.LIST,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ALL_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ALL_ERROR.message,
      );
    }
  }

  /**
   * Delete sequence configuration
   */
  static async deleteSequenceConfig(configId: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(configId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      const sequenceConfig =
        await SequenceManagement.findByIdAndDelete(configId);
      if (!sequenceConfig) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.message,
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.DELETE_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.DELETE_ERROR.message,
      );
    }
  }

  /**
   * Format sequence string based on configuration
   */
  private static formatSequence(
    format: string,
    category: ICategory,
    subcategory: ICategory | null,
    sequenceNumber: number,
  ): string {
    let formattedSequence = format;

    // Replace placeholders
    formattedSequence = formattedSequence.replace(
      '{category}',
      category.slug.toUpperCase(),
    );

    if (subcategory) {
      formattedSequence = formattedSequence.replace(
        '{subcategory}',
        subcategory.slug.toUpperCase(),
      );
    } else {
      formattedSequence = formattedSequence.replace('{subcategory}', '');
    }

    // Format sequence number with padding
    const paddedSequence = sequenceNumber.toString().padStart(3, '0');
    formattedSequence = formattedSequence.replace('{sequence}', paddedSequence);

    // Clean up any double hyphens or trailing hyphens
    formattedSequence = formattedSequence
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return formattedSequence;
  }
}

export { SequenceService };
