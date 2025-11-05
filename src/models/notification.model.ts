import mongoose, { Document, Schema } from 'mongoose';

/**
 * Notification types enum
 */
export enum NotificationType {
  MACHINE_CREATED = 'MACHINE_CREATED',
  MACHINE_APPROVED = 'MACHINE_APPROVED',
  MACHINE_REJECTED = 'MACHINE_REJECTED',
  MACHINE_EDIT_REQUESTED = 'MACHINE_EDIT_REQUESTED',
  MACHINE_DELETE_REQUESTED = 'MACHINE_DELETE_REQUESTED',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
}

/**
 * INotification interface defines the structure of notification documents
 */
export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId; // User who should receive the notification
  senderId?: mongoose.Types.ObjectId; // User who triggered the notification
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  // Related entity IDs for navigation
  relatedEntityType?: 'machine' | 'approval' | 'user';
  relatedEntityId?: mongoose.Types.ObjectId;
  // Action data for navigation
  actionUrl?: string; // URL to navigate when clicked
  actionLabel?: string; // Label for the action button
  // Additional metadata
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Notification Schema
 */
const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    relatedEntityType: {
      type: String,
      enum: ['machine', 'approval', 'user'],
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    actionLabel: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Indexes for efficient queries
 */
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema,
);
