import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import NotificationService from '../services/notification.service';
import { NotificationType } from '../../../models/notification.model';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
    department: string;
  };
}

class NotificationController {
  /**
   * Get user's notifications
   * GET /api/notifications
   */
  static getNotifications = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_NOTIFICATIONS',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const read = req.query?.['read'] as string | undefined;
      const type = req.query?.['type'] as NotificationType | undefined;
      const limit = parseInt((req.query?.['limit'] as string) || '50');

      const filters: {
        read?: boolean;
        type?: NotificationType;
        limit: number;
      } = {
        limit,
      };

      if (read === 'true') {
        filters.read = true;
      } else if (read === 'false') {
        filters.read = false;
      }

      if (type) {
        filters.type = type;
      }

      const result = await NotificationService.getUserNotifications(
        req.user._id,
        filters,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'Notifications retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get unread count
   * GET /api/notifications/unread-count
   */
  static getUnreadCount = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_UNREAD_COUNT',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const count = await NotificationService.getUnreadCount(req.user._id);

      const response = new ApiResponse(
        StatusCodes.OK,
        { count },
        'Unread count retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  static markAsRead = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'MARK_NOTIFICATION_READ',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = (req.params || {}) as { id?: string };
      if (!id) {
        throw new ApiError(
          'MARK_NOTIFICATION_READ',
          StatusCodes.BAD_REQUEST,
          'MISSING_NOTIFICATION_ID',
          'Notification ID is required',
        );
      }

      const notification = await NotificationService.markAsRead(
        id,
        req.user._id,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        notification,
        'Notification marked as read',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/mark-all-read
   */
  static markAllAsRead = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'MARK_ALL_READ',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const count = await NotificationService.markAllAsRead(req.user._id);

      const response = new ApiResponse(
        StatusCodes.OK,
        { markedCount: count },
        'All notifications marked as read',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  static deleteNotification = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'DELETE_NOTIFICATION',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = (req.params || {}) as { id?: string };
      if (!id) {
        throw new ApiError(
          'DELETE_NOTIFICATION',
          StatusCodes.BAD_REQUEST,
          'MISSING_NOTIFICATION_ID',
          'Notification ID is required',
        );
      }

      await NotificationService.deleteNotification(id, req.user._id);

      const response = new ApiResponse(
        StatusCodes.OK,
        {},
        'Notification deleted successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default NotificationController;
