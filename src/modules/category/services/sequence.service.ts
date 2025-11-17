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
  updateMachineSequences?: boolean;
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

      // Store old format if format is being changed and we need to update machines
      const oldFormat = sequenceConfig.format;
      // Normalize formats for comparison (trim whitespace)
      const normalizedOldFormat = oldFormat.trim();
      const normalizedNewFormat = data.format ? data.format.trim() : '';
      const formatChanged =
        data.format && normalizedNewFormat !== normalizedOldFormat;

      console.log('🔍 Sequence Config Update Debug:');
      console.log(`   Config ID: ${configId}`);
      console.log(`   Old Format: ${oldFormat}`);
      console.log(`   New Format: ${data.format || 'not provided'}`);
      console.log(`   Format Changed: ${formatChanged}`);
      console.log(
        `   Update Machine Sequences Flag: ${data.updateMachineSequences}`,
      );
      console.log(
        `   Will Update Machines: ${formatChanged && data.updateMachineSequences}`,
      );

      // Update configuration
      const updateData: Record<string, unknown> = {
        updated_by: data.updatedBy,
        updated_at: new Date(),
      };

      if (data.sequencePrefix)
        updateData['sequence_prefix'] = data.sequencePrefix.toUpperCase();
      if (data.startingNumber !== undefined) {
        updateData['starting_number'] = data.startingNumber;
        updateData['current_sequence'] = data.startingNumber - 1; // Reset current sequence only when starting number changes
      }
      // When format changes, keep current_sequence unchanged
      if (data.format) {
        updateData['format'] = data.format;
        // Don't reset current_sequence when only format changes
      }
      if (data.isActive !== undefined) updateData['is_active'] = data.isActive;

      const updatedConfig = await SequenceManagement.findByIdAndUpdate(
        configId,
        updateData,
        { new: true },
      );

      // If format changed and updateMachineSequences flag is set, update all machine sequences
      if (formatChanged && data.updateMachineSequences && updatedConfig) {
        console.log(
          '✅ Conditions met! Calling updateMachineSequencesForConfig...',
        );
        await this.updateMachineSequencesForConfig(
          updatedConfig,
          oldFormat,
          data.updatedBy || '',
        );
      } else {
        console.log('❌ Conditions NOT met for machine sequence update:');
        console.log(`   Format Changed: ${formatChanged}`);
        console.log(`   Update Flag: ${data.updateMachineSequences}`);
        console.log(`   Updated Config Exists: ${!!updatedConfig}`);
      }

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
   * Update all machine sequences when format changes
   */
  private static async updateMachineSequencesForConfig(
    config: ISequenceManagement,
    oldFormat: string,
    updatedBy: string,
  ): Promise<void> {
    console.log('🚀 updateMachineSequencesForConfig called!');
    console.log(`   Config: ${config._id}`);
    console.log(`   Category ID: ${config.category_id}`);
    console.log(`   Subcategory ID: ${config.subcategory_id || 'null'}`);
    console.log(`   Old Format: ${oldFormat}`);
    console.log(`   New Format: ${config.format}`);

    try {
      // Get category and subcategory info
      const category = await Category.findById(config.category_id).select(
        'name slug',
      );
      if (!category) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      let subcategory: ICategory | null = null;
      if (config.subcategory_id) {
        subcategory = await Category.findById(config.subcategory_id).select(
          'name slug',
        );
      }

      // Find all machines with this category/subcategory combination
      const query: {
        category_id: mongoose.Types.ObjectId;
        subcategory_id?: mongoose.Types.ObjectId | null;
        deletedAt?: null;
        machine_sequence?: { $exists: true; $ne: null };
      } = {
        category_id: config.category_id,
        deletedAt: null,
        machine_sequence: { $exists: true, $ne: null },
      };

      if (config.subcategory_id) {
        query.subcategory_id = config.subcategory_id;
      } else {
        query.subcategory_id = null;
      }

      const machines = await Machine.find(query).select('_id machine_sequence');

      console.log(
        `🔄 Starting machine sequence update for ${machines.length} machine(s)`,
      );
      console.log(`   Old format: ${oldFormat}`);
      console.log(`   New format: ${config.format}`);

      // Prepare category and subcategory slugs for format replacement
      const categorySlug = category.slug.toUpperCase();
      const subcategorySlug = subcategory ? subcategory.slug.toUpperCase() : '';

      console.log(`   Category: ${category.name} (slug: ${categorySlug})`);
      console.log(
        `   Subcategory: ${subcategory ? subcategory.name + ' (slug: ' + subcategorySlug + ')' : 'none'}`,
      );

      // Build array of update operations
      interface MachineUpdate {
        machineId: mongoose.Types.ObjectId;
        oldSequence: string;
        newSequence: string;
        sequenceNumber: number;
      }

      const updates: MachineUpdate[] = [];
      const skipped: Array<{
        id: string;
        reason: string;
      }> = [];

      // Process each machine to extract sequence number and generate new sequence
      for (const machine of machines) {
        if (!machine.machine_sequence) {
          skipped.push({
            id: String(machine._id),
            reason: 'No machine_sequence',
          });
          continue;
        }

        // Extract sequence number from existing sequence
        const sequenceNumber = this.extractSequenceNumber(
          machine.machine_sequence,
          oldFormat,
          categorySlug,
          subcategorySlug,
        );

        if (sequenceNumber === null) {
          skipped.push({
            id: String(machine._id),
            reason: `Could not extract sequence from: ${machine.machine_sequence}`,
          });
          continue;
        }

        // Generate new sequence using new format with the same sequence number
        const newSequence = this.formatSequence(
          config.format,
          category,
          subcategory,
          sequenceNumber,
        );

        console.log(
          `   [DEBUG] Machine ${machine._id}: seq=${sequenceNumber}, format="${config.format}", category="${category.slug}", subcategory="${subcategory?.slug || 'none'}"`,
        );

        // Only add to updates if sequence actually changed
        if (newSequence !== machine.machine_sequence) {
          updates.push({
            machineId: machine._id as mongoose.Types.ObjectId,
            oldSequence: machine.machine_sequence,
            newSequence: newSequence,
            sequenceNumber: sequenceNumber,
          });
        } else {
          skipped.push({
            id: String(machine._id),
            reason: 'Sequence already matches new format',
          });
        }
      }

      // Log what will be updated
      console.log(`   Preparing to update ${updates.length} machine(s):`);
      updates.forEach((update) => {
        console.log(
          `     ${update.machineId}: "${update.oldSequence}" → "${update.newSequence}" (seq: ${update.sequenceNumber})`,
        );
      });

      if (skipped.length > 0) {
        console.log(`   Skipping ${skipped.length} machine(s):`);
        skipped.forEach((skip) => {
          console.log(`     ${skip.id}: ${skip.reason}`);
        });
      }

      // Perform bulk update using Promise.all for parallel execution
      if (updates.length > 0) {
        const updatePromises = updates.map((update) =>
          Machine.findByIdAndUpdate(
            update.machineId,
            {
              $set: {
                machine_sequence: update.newSequence,
                updatedBy: updatedBy,
                updatedAt: new Date(),
              },
            },
            { new: true },
          ),
        );

        await Promise.all(updatePromises);

        console.log(
          `✅ Successfully updated ${updates.length} machine sequence(s) using new format`,
        );
      } else {
        console.log(`ℹ️  No machines needed updating`);
      }
    } catch (error) {
      // Log error but don't fail the entire update
      console.error('❌ Error updating machine sequences:', error);
      // Re-throw if it's an ApiError, otherwise wrap it
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'MACHINE_SEQUENCE_UPDATE_ERROR',
        'Failed to update machine sequences. Sequence config was updated but machine sequences may need manual update.',
      );
    }
  }

  /**
   * Extract sequence number from existing machine sequence string
   * This method tries multiple strategies to reliably extract the numeric sequence value
   */
  private static extractSequenceNumber(
    machineSequence: string,
    oldFormat: string,
    categorySlug: string,
    subcategorySlug: string,
  ): number | null {
    // Method 1: Try to reverse-engineer by matching the old format pattern
    if (oldFormat.includes('{sequence}')) {
      try {
        // Build a regex pattern from the old format
        // Escape special regex characters first
        const pattern = oldFormat
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\{category\\\}/g, this.escapeRegex(categorySlug))
          .replace(/\\\{subcategory\\\}/g, subcategorySlug || '[A-Z0-9-]*')
          .replace(/\\\{sequence\\\}/g, '(\\d+)');

        const regex = new RegExp(`^${pattern}$`, 'i');
        const match = machineSequence.match(regex);

        if (match) {
          // Find the sequence capture group
          // Count how many placeholders come before {sequence}
          const sequenceIndex = oldFormat.indexOf('{sequence}');
          const beforeSequence = oldFormat.substring(0, sequenceIndex);
          const categoryCount = (beforeSequence.match(/\{category\}/g) || [])
            .length;
          const subcategoryCount = (
            beforeSequence.match(/\{subcategory\}/g) || []
          ).length;

          // The sequence is at index: categoryCount + subcategoryCount + 1
          const sequenceGroupIndex = categoryCount + subcategoryCount + 1;
          if (match[sequenceGroupIndex]) {
            const extracted = parseInt(match[sequenceGroupIndex], 10);
            if (!isNaN(extracted)) {
              return extracted;
            }
          }
        }
      } catch (e) {
        // Pattern matching failed, try other methods
        console.warn(
          `Pattern matching failed for format: ${oldFormat}`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    // Method 2: Try to find padded sequence numbers (001, 002, etc.)
    // Look for 3-digit padded numbers (most common format)
    const paddedMatch = machineSequence.match(/\b0+([1-9]\d{2,})\b/);
    if (paddedMatch && paddedMatch[1]) {
      const extracted = parseInt(paddedMatch[1], 10);
      if (!isNaN(extracted)) {
        return extracted;
      }
    }

    // Method 3: Look for any zero-padded number
    const zeroPaddedMatch = machineSequence.match(/\b0+(\d+)\b/);
    if (zeroPaddedMatch && zeroPaddedMatch[1]) {
      const extracted = parseInt(zeroPaddedMatch[1], 10);
      if (!isNaN(extracted)) {
        return extracted;
      }
    }

    // Method 4: Extract all numbers and use the one that looks like a sequence
    const allNumbers = machineSequence.match(/\d+/g);
    if (allNumbers && allNumbers.length > 0) {
      // Prefer numbers that are 2+ digits (likely sequence numbers)
      const sequenceCandidates = allNumbers.filter((n) => n && n.length >= 2);
      if (sequenceCandidates.length > 0) {
        const lastCandidate = sequenceCandidates[sequenceCandidates.length - 1];
        if (!lastCandidate) return null;
        const extracted = parseInt(lastCandidate, 10);
        if (!isNaN(extracted)) {
          return extracted;
        }
      }
      // Fallback to last number
      const lastNumber = allNumbers[allNumbers.length - 1];
      if (lastNumber !== undefined) {
        const extracted = parseInt(lastNumber, 10);
        if (!isNaN(extracted)) {
          return extracted;
        }
      }
    }

    return null;
  }

  /**
   * Escape special regex characters in a string
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
