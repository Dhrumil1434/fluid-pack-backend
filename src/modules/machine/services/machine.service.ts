// services/machine.service.ts
import { StatusCodes } from 'http-status-codes';
// import { Machine, IMachine } from '../models/machine.model';
// import { Category } from '../../categories/models/category.model';
// import { ApiError } from '../../../../utils/ApiError';
// import { ERROR_MESSAGES } from '../../../../constants/errorMessages';
import mongoose from 'mongoose';
import { User } from '../../../models/user.model';

import { IMachine, Machine } from '../../../models/machine.model';
import { SO } from '../../../models/so.model';
import { ApiError } from '../../../utils/ApiError';
import { ERROR_MESSAGES } from '../machine.error.constant';
import {
  sanitizeMachine,
  sanitizeMachines,
} from '../../../utils/sanitizeMachineResponse';
import {
  SequenceService,
  SequenceGenerationData,
} from '../../category/services/sequence.service';
import { ISO } from '../../../models/so.model';
export interface CreateMachineData {
  so_id: string; // Reference to SO (Sales Order)
  created_by: string;
  images?: string[];
  documents?: Array<{
    name: string;
    file_path: string;
    document_type?: string;
  }>;
  location?: string;
  dispatch_date?: Date | string;
  metadata?: Record<string, unknown>;
  is_approved?: boolean;
}

export interface UpdateMachineData {
  so_id?: string; // Update SO reference if needed
  images?: string[];
  documents?: Array<{
    name: string;
    file_path: string;
    document_type?: string;
  }>;
  location?: string;
  dispatch_date?: Date | string | null;
  machine_sequence?: string; // Can be updated but usually auto-generated
  metadata?: Record<string, unknown>;
  removedDocuments?: Array<{
    _id?: string;
    name?: string;
    file_path?: string;
    document_type?: string;
  }>;
  removedImages?: string[]; // Array of image URLs to be removed
  is_approved?: boolean;
  updatedBy?: string;
}

export interface MachineListResult {
  machines: IMachine[];
  total: number;
  pages: number;
}

export interface MachineFilters {
  so_id?: string; // Filter by SO ID
  category_id?: string; // Filter by SO's category_id
  is_approved?: boolean;
  created_by?: string;
  search?: string; // Search in SO name, SO party_name, location, machine_sequence
  has_sequence?: boolean;
  metadata_key?: string;
  metadata_value?: string;
  dispatch_date_from?: string | Date;
  dispatch_date_to?: string | Date;
  so_date_from?: string | Date; // Filter by SO's so_date (from)
  so_date_to?: string | Date; // Filter by SO's so_date (to)
  po_date_from?: string | Date; // Filter by SO's po_date (from)
  po_date_to?: string | Date; // Filter by SO's po_date (to)
  // Specific field filters for suggestion-based search
  party_name?: string; // Filter by SO's party_name
  machine_sequence?: string;
  location?: string;
  sortBy?:
    | 'createdAt'
    | 'name' // Sort by SO name
    | 'category' // Sort by SO category
    | 'dispatch_date'
    | 'party_name' // Sort by SO party_name
    | 'machine_sequence'
    | 'location'
    | 'created_by';
  sortOrder?: 'asc' | 'desc';
}

class MachineService {
  /**
   * Create a new machine
   */
  static async create(data: CreateMachineData): Promise<IMachine> {
    try {
      // Verify SO exists and is active
      const so = await SO.findOne({
        _id: data.so_id,
        deletedAt: null,
        is_active: true,
      });

      if (!so) {
        // Check if SO exists but is deleted
        const deletedSO = await SO.findOne({
          _id: data.so_id,
          deletedAt: { $ne: null },
        });

        if (deletedSO) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            'SO_DELETED',
            'Cannot create machine: The selected SO has been deleted. Please restore the SO first or select a different active SO.',
          );
        }

        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          'SO_NOT_FOUND',
          'SO not found or is not active. Please select a valid active SO.',
        );
      }

      // Parse dispatch_date if provided as string
      let dispatchDate: Date | null = null;
      if (data.dispatch_date) {
        if (
          typeof data.dispatch_date === 'string' &&
          data.dispatch_date.trim() !== ''
        ) {
          const parsedDate = new Date(data.dispatch_date);
          // Check if date is valid
          if (!isNaN(parsedDate.getTime())) {
            dispatchDate = parsedDate;
          }
        } else if (data.dispatch_date instanceof Date) {
          dispatchDate = data.dispatch_date;
        }
      }

      // Machine sequence will be auto-generated later if needed
      // For now, leave it as null
      const machine = new Machine({
        so_id: data.so_id,
        created_by: data.created_by,
        images: data.images || [],
        documents: data.documents || [],
        location: data.location ? data.location.trim() : undefined,
        dispatch_date: dispatchDate,
        machine_sequence: null, // Auto-generated later if needed
        metadata: data.metadata || {},
        is_approved:
          typeof data.is_approved === 'boolean' ? data.is_approved : false,
      });

      await machine.save();

      // Populate SO and creator information
      await machine.populate([
        {
          path: 'so_id',
          select:
            'name customer so_number category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description' },
            { path: 'subcategory_id', select: 'name description' },
          ],
        },
        { path: 'created_by', select: 'username email' },
      ]);

      return machine;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_MACHINE_ERROR',
        'Failed to create machine',
      );
    }
  }

  /**
   * Get all machines with pagination and filters
   */
  static async getAll(
    page: number,
    limit: number,
    filters: MachineFilters = {},
  ): Promise<MachineListResult> {
    try {
      const skip = (page - 1) * limit;
      const query: Record<string, unknown> = { deletedAt: null };

      // Apply filters
      if (filters.so_id) {
        query['so_id'] = filters.so_id;
      }

      // Filter by SO's category_id - find matching SOs first
      if (filters.category_id) {
        const matchingSOs = await SO.find({
          category_id: filters.category_id,
          deletedAt: null,
          is_active: true,
        })
          .select('_id')
          .lean();
        const soIds = matchingSOs.map(
          (so) => so._id as mongoose.Types.ObjectId,
        );
        if (soIds.length > 0) {
          query['so_id'] = { $in: soIds };
        } else {
          // No matching SOs, return empty result
          return {
            machines: [],
            total: 0,
            pages: 0,
          };
        }
      }

      if (typeof filters.is_approved === 'boolean') {
        query['is_approved'] = filters.is_approved;
      }

      if (filters.created_by) {
        query['created_by'] = filters.created_by;
      }

      // Build $and array for complex queries
      const andConditions: Array<Record<string, unknown>> = [];

      // Handle search filter - search across SO fields and machine fields
      if (filters.search) {
        const searchRegex = { $regex: filters.search, $options: 'i' };
        // First, find users matching the search term for created_by
        const matchingUsers = await User.find({
          $or: [{ username: searchRegex }, { email: searchRegex }],
        })
          .select('_id')
          .lean();
        const matchingUserIds = matchingUsers.map(
          (u) => u._id as mongoose.Types.ObjectId,
        );

        // Find SOs matching the search term
        const matchingSOs = await SO.find({
          $or: [
            { name: searchRegex },
            { party_name: searchRegex },
            { mobile_number: searchRegex },
          ],
          deletedAt: null,
        })
          .select('_id')
          .lean();

        const matchingSOIds = matchingSOs.map(
          (so) => so._id as mongoose.Types.ObjectId,
        );

        const searchOrConditions: Array<Record<string, unknown>> = [
          { location: searchRegex },
          { machine_sequence: searchRegex },
        ];

        // Add SO ID search if matching SOs found
        if (matchingSOIds.length > 0) {
          searchOrConditions.push({ so_id: { $in: matchingSOIds } });
        }

        // If search term looks like an ObjectId (24 hex characters), also search by _id and so_id
        if (/^[0-9a-fA-F]{24}$/.test(filters.search.trim())) {
          try {
            const searchObjectId = new mongoose.Types.ObjectId(
              filters.search.trim(),
            );
            searchOrConditions.push({
              _id: searchObjectId,
            });
            // Also search in SO IDs
            searchOrConditions.push({ so_id: searchObjectId });
          } catch {
            // Invalid ObjectId format, skip
          }
        }

        // Add created_by search if matching users found
        if (matchingUserIds.length > 0) {
          searchOrConditions.push({ created_by: { $in: matchingUserIds } });
        }

        andConditions.push({
          $or: searchOrConditions,
        });
      }

      // Handle has_sequence filter
      if (typeof filters.has_sequence === 'boolean') {
        if (filters.has_sequence) {
          query['machine_sequence'] = {
            $exists: true,
            $ne: null,
            $nin: [''],
          };
        } else {
          andConditions.push({
            $or: [
              { machine_sequence: { $exists: false } },
              { machine_sequence: null },
              { machine_sequence: '' },
            ],
          });
        }
      }

      // Combine $and conditions if any exist
      if (andConditions.length > 0) {
        if (andConditions.length === 1) {
          Object.assign(query, andConditions[0]);
        } else {
          query['$and'] = andConditions;
        }
      }

      // Handle metadata key-value search
      if (filters.metadata_key) {
        const metadataKey = filters.metadata_key.trim();
        if (filters.metadata_value) {
          // Search for specific key-value pair
          const metadataValue = filters.metadata_value.trim();
          query[`metadata.${metadataKey}`] = {
            $regex: metadataValue,
            $options: 'i',
          };
        } else {
          // Just check if key exists
          query[`metadata.${metadataKey}`] = { $exists: true };
        }
      }

      // Handle dispatch_date range filter
      if (filters.dispatch_date_from || filters.dispatch_date_to) {
        const dateQuery: { $gte?: Date; $lte?: Date } = {};
        if (filters.dispatch_date_from) {
          dateQuery.$gte = new Date(filters.dispatch_date_from);
        }
        if (filters.dispatch_date_to) {
          const toDate = new Date(filters.dispatch_date_to);
          toDate.setHours(23, 59, 59, 999); // Include entire end date
          dateQuery.$lte = toDate;
        }
        query['dispatch_date'] = dateQuery;
      }

      // Handle SO date range filter - find matching SOs first
      if (filters.so_date_from || filters.so_date_to) {
        const soDateQuery: Record<string, unknown> = {
          deletedAt: null,
          is_active: true,
        };
        if (filters.so_date_from || filters.so_date_to) {
          const dateQuery: { $gte?: Date; $lte?: Date } = {};
          if (filters.so_date_from) {
            dateQuery.$gte = new Date(filters.so_date_from);
          }
          if (filters.so_date_to) {
            const toDate = new Date(filters.so_date_to);
            toDate.setHours(23, 59, 59, 999); // Include entire end date
            dateQuery.$lte = toDate;
          }
          soDateQuery['so_date'] = dateQuery;
        }
        const matchingSOs = await SO.find(soDateQuery).select('_id').lean();
        const soIds = matchingSOs.map(
          (so) => so._id as mongoose.Types.ObjectId,
        );
        if (soIds.length > 0) {
          if (query['so_id']) {
            // If so_id filter already exists, intersect with SO date results
            const existingSOIdValue = query['so_id'];
            const existingSOIds = Array.isArray(existingSOIdValue)
              ? ((existingSOIdValue as unknown as { $in: unknown[] })[
                  '$in'
                ] as unknown[]) || []
              : [existingSOIdValue];
            query['so_id'] = {
              $in: (existingSOIds as unknown[]).filter((id: unknown) =>
                soIds.some((sid: unknown) => String(sid) === String(id)),
              ),
            };
          } else {
            query['so_id'] = { $in: soIds };
          }
        } else {
          // No matching SOs, return empty result
          return {
            machines: [],
            total: 0,
            pages: 0,
          };
        }
      }

      // Handle PO date range filter - find matching SOs first
      if (filters.po_date_from || filters.po_date_to) {
        const poDateQuery: Record<string, unknown> = {
          deletedAt: null,
          is_active: true,
        };
        if (filters.po_date_from || filters.po_date_to) {
          const dateQuery: { $gte?: Date; $lte?: Date } = {};
          if (filters.po_date_from) {
            dateQuery.$gte = new Date(filters.po_date_from);
          }
          if (filters.po_date_to) {
            const toDate = new Date(filters.po_date_to);
            toDate.setHours(23, 59, 59, 999); // Include entire end date
            dateQuery.$lte = toDate;
          }
          poDateQuery['po_date'] = dateQuery;
        }
        const matchingSOs = await SO.find(poDateQuery).select('_id').lean();
        const soIds = matchingSOs.map(
          (so) => so._id as mongoose.Types.ObjectId,
        );
        if (soIds.length > 0) {
          if (query['so_id']) {
            // If so_id filter already exists, intersect with PO date results
            const existingSOIdValue = query['so_id'];
            const existingSOIds = Array.isArray(existingSOIdValue)
              ? ((existingSOIdValue as unknown as { $in: unknown[] })[
                  '$in'
                ] as unknown[]) || []
              : [existingSOIdValue];
            query['so_id'] = {
              $in: (existingSOIds as unknown[]).filter((id: unknown) =>
                soIds.some((sid: unknown) => String(sid) === String(id)),
              ),
            };
          } else {
            query['so_id'] = { $in: soIds };
          }
        } else {
          // No matching SOs, return empty result
          return {
            machines: [],
            total: 0,
            pages: 0,
          };
        }
      }

      // Handle specific field filters for suggestion-based search
      // Filter by SO's party_name
      if (filters.party_name) {
        const matchingSOs = await SO.find({
          party_name: { $regex: filters.party_name, $options: 'i' },
          deletedAt: null,
          is_active: true,
        })
          .select('_id')
          .lean();
        const soIds = matchingSOs.map(
          (so) => so._id as mongoose.Types.ObjectId,
        );
        if (soIds.length > 0) {
          if (query['so_id']) {
            // If so_id filter already exists, intersect with party_name results
            const existingSOIdValue = query['so_id'];
            const existingSOIds = Array.isArray(existingSOIdValue)
              ? ((existingSOIdValue as unknown as { $in: unknown[] })[
                  '$in'
                ] as unknown[]) || []
              : [existingSOIdValue];
            query['so_id'] = {
              $in: (existingSOIds as unknown[]).filter((id: unknown) =>
                soIds.some((sid: unknown) => String(sid) === String(id)),
              ),
            };
          } else {
            query['so_id'] = { $in: soIds };
          }
        } else {
          // No matching SOs, return empty result
          return {
            machines: [],
            total: 0,
            pages: 0,
          };
        }
      }

      if (filters.machine_sequence) {
        query['machine_sequence'] = {
          $regex: filters.machine_sequence,
          $options: 'i',
        };
      }

      if (filters.location) {
        query['location'] = { $regex: filters.location, $options: 'i' };
      }

      // Determine sort order
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      let sortField: Record<string, 1 | -1> = { createdAt: -1 }; // Default: latest first

      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'name':
            // Sort by SO name - we'll need to sort after population or use aggregation
            // For now, sort by so_id (will be sorted by SO creation order)
            sortField = { so_id: sortOrder };
            break;
          case 'category':
            // Sort by SO's category - sort by so_id for now
            sortField = { so_id: sortOrder };
            break;
          case 'dispatch_date':
            sortField = { dispatch_date: sortOrder };
            break;
          case 'party_name':
            // Sort by SO's party_name - sort by so_id for now
            sortField = { so_id: sortOrder };
            break;
          case 'machine_sequence':
            sortField = { machine_sequence: sortOrder };
            break;
          case 'location':
            sortField = { location: sortOrder };
            break;
          case 'created_by':
            sortField = { created_by: sortOrder };
            break;
          case 'createdAt':
          default:
            sortField = { createdAt: sortOrder };
            break;
        }
      }

      const [machines, total] = await Promise.all([
        Machine.find(query)
          .populate([
            {
              path: 'so_id',
              select:
                'name customer so_number po_number so_date po_date location category_id subcategory_id party_name mobile_number description is_active',
              populate: [
                { path: 'category_id', select: 'name description slug' },
                { path: 'subcategory_id', select: 'name description slug' },
              ],
            },
            { path: 'created_by', select: 'username email' },
            { path: 'updatedBy', select: 'username email' },
          ])
          .sort(sortField)
          .skip(skip)
          .limit(limit)
          .lean(), // Use lean() to get plain objects
        Machine.countDocuments(query),
      ]);

      // Sanitize machines to handle null populated fields
      const sanitizedMachines = sanitizeMachines(machines);

      return {
        machines: sanitizedMachines as IMachine[],
        total,
        pages: Math.ceil(total / limit),
      };
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINES_ERROR',
        'Failed to retrieve machines',
      );
    }
  }

  /**
   * Get machine by ID
   */
  static async getById(id: string): Promise<IMachine> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      })
        .populate([
          {
            path: 'so_id',
            select:
              'name category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description slug' },
              { path: 'subcategory_id', select: 'name description slug' },
            ],
          },
          { path: 'created_by', select: 'username email' },
          { path: 'updatedBy', select: 'username email' },
        ])
        .lean(); // Use lean() to get plain object

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      // Sanitize the response to handle null populated fields
      return sanitizeMachine(machine) as IMachine;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINE_ERROR',
        'Failed to retrieve machine',
      );
    }
  }

  /**
   * Update machine
   */
  static async update(id: string, data: UpdateMachineData): Promise<IMachine> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      // Check if machine exists
      const existingMachine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!existingMachine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      // Check if SO is being changed
      const isSOChanging =
        data.so_id && String(data.so_id) !== String(existingMachine.so_id);
      let newSO: ISO | null = null;

      // If SO is being updated, verify it exists and is active
      if (data.so_id) {
        newSO = await SO.findOne({
          _id: data.so_id,
          deletedAt: null,
          is_active: true,
        })
          .populate('category_id', 'name slug')
          .populate('subcategory_id', 'name slug')
          .lean();

        if (!newSO) {
          // Check if SO exists but is deleted
          const deletedSO = await SO.findOne({
            _id: data.so_id,
            deletedAt: { $ne: null },
          });

          if (deletedSO) {
            throw new ApiError(
              ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              'SO_DELETED',
              'Cannot update machine: The selected SO has been deleted. Please restore the SO first or select a different active SO.',
            );
          }

          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
            StatusCodes.BAD_REQUEST,
            'SO_NOT_FOUND',
            'SO not found or is not active. Please select a valid active SO.',
          );
        }
      }

      // Check for duplicate sequence number
      if (
        data.machine_sequence !== undefined &&
        data.machine_sequence !== null &&
        data.machine_sequence.trim() !== ''
      ) {
        const duplicateSequenceMachine = await Machine.findOne({
          machine_sequence: data.machine_sequence.trim(),
          _id: { $ne: id },
          deletedAt: null,
        });

        if (duplicateSequenceMachine) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
            StatusCodes.CONFLICT,
            'DUPLICATE_SEQUENCE',
            `Machine sequence "${data.machine_sequence}" is already assigned to another machine`,
          );
        }
      }

      const updateData: Partial<UpdateMachineData> = { ...data };
      if (data.so_id) {
        updateData.so_id = data.so_id;
      }
      if (data.location) {
        updateData.location = data.location.trim();
      }
      // Handle dispatch_date
      if (data.dispatch_date !== undefined) {
        if (data.dispatch_date === null || data.dispatch_date === '') {
          updateData.dispatch_date = null;
        } else if (typeof data.dispatch_date === 'string') {
          updateData.dispatch_date = new Date(data.dispatch_date);
        } else if (data.dispatch_date instanceof Date) {
          updateData.dispatch_date = data.dispatch_date;
        }
      }

      // If SO is changing, regenerate sequence based on new SO's category
      if (isSOChanging && newSO) {
        try {
          // Extract category and subcategory IDs
          let categoryId: string;
          const catId = newSO.category_id;
          if (
            catId &&
            typeof catId === 'object' &&
            catId !== null &&
            '_id' in catId
          ) {
            categoryId = String((catId as { _id: unknown })._id);
          } else {
            categoryId = String(catId);
          }

          let subcategoryId: string | null = null;
          const subcatId = newSO.subcategory_id;
          if (
            subcatId &&
            typeof subcatId === 'object' &&
            subcatId !== null &&
            '_id' in subcatId
          ) {
            subcategoryId = String((subcatId as { _id: unknown })._id);
          } else if (subcatId) {
            subcategoryId = String(subcatId);
          }

          // Generate new sequence for the new category/subcategory
          const sequenceData: SequenceGenerationData = { categoryId };
          if (subcategoryId) {
            sequenceData.subcategoryId = subcategoryId;
          }
          const newSequence =
            await SequenceService.generateSequence(sequenceData);

          // Set the new sequence and unapprove machine (sequence changed)
          updateData.machine_sequence = newSequence;
          updateData.is_approved = false; // Unapprove when SO changes

          console.log(
            `[Machine Service] SO changed for machine ${id}. ` +
              `Old SO: ${existingMachine.so_id}, New SO: ${data.so_id}. ` +
              `New sequence: ${newSequence}`,
          );
        } catch (error) {
          // If sequence generation fails, log error but don't fail the update
          // The machine will be updated without sequence, which can be generated later
          console.error(
            `[Machine Service] Failed to generate sequence for machine ${id} after SO change:`,
            error,
          );
          // Clear sequence if generation fails
          updateData.machine_sequence = '';
          updateData.is_approved = false; // Still unapprove when SO changes
        }
      } else {
        // Handle machine_sequence: empty string means remove sequence (only if SO is not changing)
        if (data.machine_sequence !== undefined) {
          updateData.machine_sequence =
            data.machine_sequence.trim() === ''
              ? ''
              : data.machine_sequence.trim();
        }
      }

      // Handle image removal
      if (data.removedImages && data.removedImages.length > 0) {
        const currentImages = existingMachine.images || [];
        // Filter out removed images from current images
        const updatedImages = currentImages.filter(
          (img) => !data.removedImages!.includes(img),
        );
        // Store the filtered images (new images will be merged by controller)
        updateData.images = updatedImages;
      }

      // Handle document removal
      if (data.removedDocuments && data.removedDocuments.length > 0) {
        const currentDocuments = existingMachine.documents || [];
        const removedFilePaths = data.removedDocuments
          .map((doc) => doc.file_path)
          .filter(Boolean);

        // Filter out removed documents from current documents
        const updatedDocuments = currentDocuments.filter(
          (doc) => !removedFilePaths.includes(doc.file_path),
        );

        // Set documents to the filtered list (remaining documents after removal)
        // New documents will be merged by the controller after this update
        updateData.documents = updatedDocuments;
        // Store removed document paths for Cloudinary deletion (will be handled in controller)
        (updateData as Record<string, unknown>)['__removedDocuments'] =
          removedFilePaths;
      } else {
        // No documents are being removed
        // If updateData.documents is explicitly provided (with new documents from controller), merge with existing
        if (updateData.documents && Array.isArray(updateData.documents)) {
          // New documents are being added - merge with existing documents
          const existingDocuments = existingMachine.documents || [];
          updateData.documents = [
            ...existingDocuments,
            ...updateData.documents,
          ];
        } else {
          // No new documents and no removal - preserve existing documents
          // Don't set documents field - MongoDB will preserve existing documents
          delete updateData.documents;
        }
      }

      // Remove the removedDocuments and removedImages fields from updateData as they're not database fields
      delete updateData.removedDocuments;
      delete (updateData as Record<string, unknown>)['removedImages'];

      const machine = await Machine.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate([
        {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return machine!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_MACHINE_ERROR',
        'Failed to update machine',
      );
    }
  }

  /**
   * Delete machine (soft delete)
   */
  static async delete(id: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.DELETE,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.DELETE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      await Machine.findByIdAndUpdate(id, {
        deletedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'DELETE_MACHINE_ERROR',
        'Failed to delete machine',
      );
    }
  }

  /**
   * Get approved machines
   */
  static async getApprovedMachines(): Promise<IMachine[]> {
    try {
      return await Machine.find({
        deletedAt: null,
        is_approved: true,
      })
        .populate([
          { path: 'category_id', select: 'name description' },
          { path: 'created_by', select: 'username email' },
        ])
        .sort({ name: 1 });
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVED_MACHINES_ERROR',
        'Failed to retrieve approved machines',
      );
    }
  }

  /**
   * Update machine approval status
   */
  static async updateApprovalStatus(
    id: string,
    is_approved: boolean,
    updatedBy: string,
  ): Promise<IMachine> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      const updatedMachine = await Machine.findByIdAndUpdate(
        id,
        {
          is_approved,
          updatedBy,
        },
        { new: true, runValidators: true },
      ).populate([
        {
          path: 'so_id',
          select:
            'name category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
          ],
        },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return updatedMachine!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_APPROVAL_ERROR',
        'Failed to update machine approval status',
      );
    }
  }

  /**
   * Check if machine exists
   */
  static async exists(id: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      return !!machine;
    } catch {
      return false;
    }
  }

  /**
   * Get machines by category
   */
  static async getMachinesByCategory(categoryId: string): Promise<IMachine[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          'INVALID_CATEGORY_ID',
          'Invalid category ID format',
        );
      }

      return await Machine.find({
        category_id: categoryId,
        deletedAt: null,
        is_approved: true,
      })
        .populate([
          { path: 'category_id', select: 'name description' },
          { path: 'created_by', select: 'username email' },
        ])
        .sort({ name: 1 });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINES_BY_CATEGORY_ERROR',
        'Failed to retrieve machines by category',
      );
    }
  }

  /**
   * Get machine statistics
   */
  static async getMachineStatistics(): Promise<{
    totalMachines: number;
    activeMachines: number;
    inactiveMachines: number;
    pendingMachines: number;
    approvedMachines: number;
    machinesByCategory: Array<{ _id: string; count: number }>;
    recentMachines: number;
  }> {
    try {
      const totalMachines = await Machine.countDocuments();
      const activeMachines = await Machine.countDocuments({ is_active: true });
      const inactiveMachines = await Machine.countDocuments({
        is_active: false,
      });
      const pendingMachines = await Machine.countDocuments({
        is_approved: false,
      });
      const approvedMachines = await Machine.countDocuments({
        is_approved: true,
      });

      // Get machines by category
      const machinesByCategory = await Machine.aggregate([
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $unwind: '$category',
        },
        {
          $group: {
            _id: '$category.name',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get recent machines (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentMachines = await Machine.countDocuments({
        created_at: { $gte: thirtyDaysAgo },
      });

      return {
        totalMachines,
        activeMachines,
        inactiveMachines,
        pendingMachines,
        approvedMachines,
        machinesByCategory,
        recentMachines,
      };
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINE_STATISTICS_ERROR',
        'Failed to retrieve machine statistics',
      );
    }
  }
}

export default MachineService;
