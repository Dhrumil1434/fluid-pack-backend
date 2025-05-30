import mongoose, { Schema, Document } from 'mongoose';

/**
 * Approval request types
 */
export enum ApprovalType {
  MACHINE_CREATION = 'MACHINE_CREATION',
  MACHINE_EDIT = 'MACHINE_EDIT',
  MACHINE_DELETION = 'MACHINE_DELETION',
}

/**
 * Approval status
 */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * IMachineApproval interface defines the structure of machine approval requests
 */
export interface IMachineApproval extends Document {
  machineId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  approvalType: ApprovalType;
  status: ApprovalStatus;

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
 * Machine Approval Schema
 */
const machineApprovalSchema = new Schema<IMachineApproval>(
  {
    machineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvalType: {
      type: String,
      enum: Object.values(ApprovalType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ApprovalStatus),
      default: ApprovalStatus.PENDING,
    },
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
machineApprovalSchema.index({ status: 1, createdAt: -1 });
machineApprovalSchema.index({ requestedBy: 1, status: 1 });
machineApprovalSchema.index({ machineId: 1, approvalType: 1 });

export const MachineApproval = mongoose.model<IMachineApproval>(
  'MachineApproval',
  machineApprovalSchema,
);
