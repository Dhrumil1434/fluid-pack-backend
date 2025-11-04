import { Request, Response } from 'express';
import {
  CategoryService,
  CreateCategoryData,
  UpdateCategoryData,
} from './services/category.service';
import {
  SequenceService,
  CreateSequenceConfigData,
  UpdateSequenceConfigData,
  SequenceResetData,
} from './services/sequence.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import { ERROR_MESSAGES } from './category.error.constants';
import mongoose from 'mongoose';

// Extend Express Request to include user
interface AuthenticatedRequest extends Request {
  user?: mongoose.Document;
}

/**
 * Category Controller handles HTTP requests for category operations
 */
class CategoryController {
  /**
   * Create a new category
   */
  static async createCategory(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const createData: CreateCategoryData = {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        parentId: req.body.parentId,
        sortOrder: req.body.sortOrder,
        imageUrl: req.body.imageUrl,
        seoTitle: req.body.seoTitle,
        seoDescription: req.body.seoDescription,
        createdBy: req.user?._id as string,
      };

      const category = await CategoryService.createCategory(createData);

      const response = new ApiResponse(
        StatusCodes.CREATED,
        category,
        'Category created successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.CREATE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.CREATE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await CategoryService.getCategoryById(id as string);

      const response = new ApiResponse(
        StatusCodes.OK,
        category,
        'Category retrieved successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.code,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Get all categories
   */
  static async getAllCategories(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      console.log('getAllCategories called with query:', req.query);

      const options: {
        includeInactive?: boolean;
        level?: number | undefined;
        parentId?: string | undefined;
      } = {
        includeInactive: req.query['includeInactive'] === 'true',
        level: req.query['level']
          ? parseInt(req.query['level'] as string)
          : undefined,
        parentId: req.query['parentId'] as string | undefined,
      };

      console.log('Options passed to service:', options);

      const categories = await CategoryService.getAllCategories(options);
      console.log('Categories returned from service:', categories.length);

      const response = new ApiResponse(
        StatusCodes.OK,
        categories,
        'Categories retrieved successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.LIST,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.GET_ALL_ERROR.code,
        ERROR_MESSAGES.CATEGORY.GET_ALL_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Get category tree structure
   */
  static async getCategoryTree(
    _req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const categoryTree = await CategoryService.getCategoryTree();

      const response = new ApiResponse(
        StatusCodes.OK,
        categoryTree,
        'Category tree retrieved successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.TREE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.TREE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.TREE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Update category
   */
  static async updateCategory(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateCategoryData = {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        parentId: req.body.parentId,
        sortOrder: req.body.sortOrder,
        imageUrl: req.body.imageUrl,
        seoTitle: req.body.seoTitle,
        seoDescription: req.body.seoDescription,
        isActive: req.body.isActive,
        updatedBy: req.user?._id as string,
      };

      const category = await CategoryService.updateCategory(
        id as string,
        updateData,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        category,
        'Category updated successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.UPDATE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.UPDATE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Delete category (soft delete)
   */
  static async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await CategoryService.deleteCategory(id as string);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'Category deleted successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.DELETE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.DELETE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Get category hierarchy path
   */
  static async getCategoryPath(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const path = await CategoryService.getCategoryPath(id as string);

      const response = new ApiResponse(
        StatusCodes.OK,
        { path },
        'Category path retrieved successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.code,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }
}

/**
 * Sequence Management Controller handles HTTP requests for sequence operations
 */
class SequenceManagementController {
  /**
   * Create sequence configuration
   */
  static async createSequenceConfig(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const createData: CreateSequenceConfigData = {
        categoryId: req.body.categoryId,
        subcategoryId: req.body.subcategoryId,
        sequencePrefix: req.body.sequencePrefix,
        startingNumber: req.body.startingNumber,
        format: req.body.format,
        createdBy: req.user?._id as string,
      };

      const sequenceConfig =
        await SequenceService.createSequenceConfig(createData);

      const response = new ApiResponse(
        StatusCodes.CREATED,
        sequenceConfig,
        'Sequence configuration created successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.CREATE_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.CREATE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Get sequence configuration by ID
   */
  static async getSequenceConfigById(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const sequenceConfig = await SequenceService.getSequenceConfig(
        req.query['categoryId'] as string,
        req.query['subcategoryId'] as string,
      );

      if (!sequenceConfig) {
        const apiError = new ApiError(
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.GET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.code,
          ERROR_MESSAGES.SEQUENCE_MANAGEMENT.NOT_FOUND.message,
        );
        res.status(apiError.statusCode).json(apiError);
        return;
      }

      const response = new ApiResponse(
        StatusCodes.OK,
        sequenceConfig,
        'Sequence configuration retrieved successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Get all sequence configurations
   */
  static async getAllSequenceConfigs(
    _req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const sequenceConfigs = await SequenceService.getAllSequenceConfigs();

      const response = new ApiResponse(
        StatusCodes.OK,
        sequenceConfigs,
        'Sequence configurations retrieved successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.LIST,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ALL_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.GET_ALL_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Update sequence configuration
   */
  static async updateSequenceConfig(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateSequenceConfigData = {
        sequencePrefix: req.body.sequencePrefix,
        startingNumber: req.body.startingNumber,
        format: req.body.format,
        isActive: req.body.isActive,
        updatedBy: req.user?._id as string,
      };

      const sequenceConfig = await SequenceService.updateSequenceConfig(
        id as string,
        updateData,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        sequenceConfig,
        'Sequence configuration updated successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.UPDATE_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.UPDATE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Delete sequence configuration
   */
  static async deleteSequenceConfig(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      await SequenceService.deleteSequenceConfig(id as string);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'Sequence configuration deleted successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.DELETE_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.DELETE_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Generate next sequence number
   */
  static async generateSequence(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const sequenceData = {
        categoryId: req.body.categoryId,
        subcategoryId: req.body.subcategoryId,
      };

      const sequence = await SequenceService.generateSequence(sequenceData);

      const response = new ApiResponse(
        StatusCodes.OK,
        { sequence },
        'Sequence generated successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.GENERATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_GENERATION_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_GENERATION_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }

  /**
   * Reset sequence number
   */
  static async resetSequence(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const resetData: SequenceResetData = {
        newStartingNumber: req.body.newStartingNumber,
        updatedBy: req.user?._id as string,
      };

      const sequenceConfig = await SequenceService.resetSequence(
        id as string,
        resetData,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        sequenceConfig,
        'Sequence reset successfully',
      );

      res.status(response.statusCode).json(response);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json(error);
        return;
      }

      const apiError = new ApiError(
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.ACTION.RESET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_RESET_ERROR.code,
        ERROR_MESSAGES.SEQUENCE_MANAGEMENT.SEQUENCE_RESET_ERROR.message,
      );

      res.status(apiError.statusCode).json(apiError);
    }
  }
}

export { CategoryController, SequenceManagementController };
