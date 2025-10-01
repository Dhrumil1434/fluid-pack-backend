import mongoose, { Schema, Document } from 'mongoose';

/**
 * QC Approval request types
 */
export enum QCApprovalType {
  MACHINE_QC_ENTRY = 'MACHINE_QC_ENTRY',
  MACHINE_QC_EDIT = 'MACHINE_QC_EDIT',
  MACHINE_QC_DELETION = 'MACHINE_QC_DELETION',
  MACHINE_QC_VERIFICATION = 'MACHINE_QC_VERIFICATION',
}

/**
 * QC Approval status
 */
export enum QCApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * IQCApproval interface defines the structure of QC approval requests
 */
export interface IQCApproval extends Document {
  machineId: mongoose.Types.ObjectId;
  qcEntryId?: mongoose.Types.ObjectId; // Optional reference to QC entry
  requestedBy: mongoose.Types.ObjectId; // QC person who requested
  approvalType: QCApprovalType;
  status: QCApprovalStatus;
  approverRoles?: mongoose.Types.ObjectId[];
  approvers?: mongoose.Types.ObjectId[]; // Specific user IDs who can approve

  // QC specific data
  qcNotes?: string;
  qcFindings?: Record<string, unknown>;
  qualityScore?: number;
  inspectionDate?: Date;
  nextInspectionDate?: Date;

  // Document uploads
  documents?: Array<{
    filename: string;
    originalName: string;
    path: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
  }>;

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

  // Machine activation status
  machineActivated?: boolean;
  activationDate?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * QC Approval Schema
 */
const qcApprovalSchema = new Schema<IQCApproval>(
  {
    machineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: true,
    },
    qcEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      // Must match model name exported in qcMachine.model.ts
      ref: 'QAMachineEntry',
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvalType: {
      type: String,
      enum: Object.values(QCApprovalType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(QCApprovalStatus),
      default: QCApprovalStatus.PENDING,
    },
    approverRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    approvers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    qcNotes: {
      type: String,
      trim: true,
    },
    qcFindings: {
      type: Schema.Types.Mixed,
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    inspectionDate: {
      type: Date,
    },
    nextInspectionDate: {
      type: Date,
    },
    documents: [
      {
        filename: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        path: {
          type: String,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
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
    machineActivated: {
      type: Boolean,
      default: false,
    },
    activationDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Indexes for efficient queries
 */
qcApprovalSchema.index({ status: 1, createdAt: -1 });
qcApprovalSchema.index({ requestedBy: 1, status: 1 });
qcApprovalSchema.index({ machineId: 1, approvalType: 1 });
qcApprovalSchema.index({ approverRoles: 1, status: 1, createdAt: -1 });
qcApprovalSchema.index({ qcEntryId: 1 });
qcApprovalSchema.index({ machineActivated: 1, status: 1 });

export const QCApproval = mongoose.model<IQCApproval>(
  'QCApproval',
  qcApprovalSchema,
);
