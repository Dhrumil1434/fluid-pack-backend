import mongoose, { Schema, Document } from 'mongoose';

/**
 * SO Approval request types
 */
export enum SOApprovalType {
  SO_CREATION = 'SO_CREATION',
  SO_EDIT = 'SO_EDIT',
  SO_DELETION = 'SO_DELETION',
}

/**
 * SO Approval status
 */
export enum SOApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * ISOApproval interface defines the structure of SO approval requests
 */
export interface ISOApproval extends Document {
  soId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  approvalType: SOApprovalType;
  status: SOApprovalStatus;
  approverRoles?: mongoose.Types.ObjectId[];

  // Original data vs proposed changes
  originalData?: Record<string, unknown>;
  proposedChanges: Record<string, unknown>;

  // Approval workflow
  approvedBy?: mongoose.Types.ObjectId;
  rejectedBy?: mongoose.Types.ObjectId;
  approvalDate?: Date;
  rejectionReason?: string;

  // Comments and notes
  requestNotes?: string;
  approverNotes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * SO Approval Schema
 */
const soApprovalSchema = new Schema<ISOApproval>(
  {
    soId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SO',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvalType: {
      type: String,
      enum: Object.values(SOApprovalType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SOApprovalStatus),
      default: SOApprovalStatus.PENDING,
    },
    approverRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    originalData: {
      type: Schema.Types.Mixed,
    },
    proposedChanges: {
      type: Schema.Types.Mixed,
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvalDate: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    requestNotes: {
      type: String,
      trim: true,
    },
    approverNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Indexes for efficient queries
 */
soApprovalSchema.index({ status: 1, createdAt: -1 });
soApprovalSchema.index({ requestedBy: 1, status: 1 });
soApprovalSchema.index({ soId: 1, approvalType: 1 });
soApprovalSchema.index({ approverRoles: 1, status: 1, createdAt: -1 });

export const SOApproval = mongoose.model<ISOApproval>(
  'SOApproval',
  soApprovalSchema,
);
