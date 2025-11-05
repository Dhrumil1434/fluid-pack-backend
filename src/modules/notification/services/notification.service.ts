import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  Notification,
  INotification,
  NotificationType,
} from '../../../models/notification.model';
import { ApiError } from '../../../utils/ApiError';

export interface CreateNotificationData {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: 'machine' | 'approval' | 'user';
  relatedEntityId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilters {
  recipientId?: string;
  read?: boolean;
  type?: NotificationType;
  limit?: number;
}

export interface NotificationListResult {
  notifications: INotification[];
  total: number;
  unreadCount: number;
}

class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(
    data: CreateNotificationData,
  ): Promise<INotification> {
    try {
      const notification = new Notification({
        recipientId: new mongoose.Types.ObjectId(data.recipientId),
        senderId: data.senderId
          ? new mongoose.Types.ObjectId(data.senderId)
          : undefined,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId
          ? new mongoose.Types.ObjectId(data.relatedEntityId)
          : undefined,
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
        metadata: data.metadata,
        read: false,
      });

      await notification.save();

      // Populate sender if available
      if (data.senderId) {
        await notification.populate({
          path: 'senderId',
          select: 'username email',
        });
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new ApiError(
        'CREATE_NOTIFICATION',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_NOTIFICATION_ERROR',
        'Failed to create notification',
      );
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {},
  ): Promise<NotificationListResult> {
    try {
      const query: Record<string, unknown> = {
        recipientId: new mongoose.Types.ObjectId(userId),
      };

      if (typeof filters.read === 'boolean') {
        query['read'] = filters.read;
      }

      if (filters.type) {
        query['type'] = filters.type;
      }

      const limit = filters.limit || 50;

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
          .populate({
            path: 'senderId',
            select: 'username email',
          })
          .sort({ createdAt: -1 })
          .limit(limit),
        Notification.countDocuments(query),
        Notification.countDocuments({
          recipientId: new mongoose.Types.ObjectId(userId),
          read: false,
        }),
      ]);

      return {
        notifications,
        total,
        unreadCount,
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw new ApiError(
        'GET_NOTIFICATIONS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_NOTIFICATIONS_ERROR',
        'Failed to retrieve notifications',
      );
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<INotification> {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipientId: userId,
      });

      if (!notification) {
        throw new ApiError(
          'MARK_NOTIFICATION_READ',
          StatusCodes.NOT_FOUND,
          'NOTIFICATION_NOT_FOUND',
          'Notification not found',
        );
      }

      notification.read = true;
      notification.readAt = new Date();
      await notification.save();

      return notification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'MARK_NOTIFICATION_READ',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'MARK_READ_ERROR',
        'Failed to mark notification as read',
      );
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await Notification.updateMany(
        {
          recipientId: new mongoose.Types.ObjectId(userId),
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        },
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw new ApiError(
        'MARK_ALL_READ',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'MARK_ALL_READ_ERROR',
        'Failed to mark all notifications as read',
      );
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        recipientId: userId,
      });

      if (result.deletedCount === 0) {
        throw new ApiError(
          'DELETE_NOTIFICATION',
          StatusCodes.NOT_FOUND,
          'NOTIFICATION_NOT_FOUND',
          'Notification not found',
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'DELETE_NOTIFICATION',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'DELETE_NOTIFICATION_ERROR',
        'Failed to delete notification',
      );
    }
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await Notification.countDocuments({
        recipientId: new mongoose.Types.ObjectId(userId),
        read: false,
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}

export default NotificationService;
