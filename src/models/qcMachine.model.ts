import mongoose, { Schema, Document } from 'mongoose';

/**
 * Document interface for QC entry documentation
 */
export interface IQCDocument {
  name: string;
  file_path: string;
  document_type?: string;
  uploaded_at: Date;
}

/**
 * IQAMachineEntry interface defines the structure of a QA Machine Entry document
 * Enhanced to include all machine fields and QC-specific data
 */
export interface IQAMachineEntry extends Document {
  machine_id: mongoose.Types.ObjectId;
  added_by: mongoose.Types.ObjectId;

  // Machine fields (copied from machine creation)
  name: string;
  category_id: mongoose.Types.ObjectId;
  subcategory_id?: mongoose.Types.ObjectId;
  machine_sequence?: string;
  party_name: string;
  location: string;
  mobile_number: string;
  dispatch_date?: Date;
  images: string[]; // Array of image URLs/paths
  documents: IQCDocument[]; // Array of document objects with names and paths

  // QC-specific fields
  qcNotes?: string;
  qualityScore?: number;
  inspectionDate?: Date;
  qc_date?: Date; // QC inspection date
  nextInspectionDate?: Date;
  report_link?: string;
  files: string[]; // Array of file URLs/paths for uploaded QC documents

  metadata?: Record<string, unknown>;
  is_active?: boolean;
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * QA Machine Entry Schema
 * Enhanced to include all machine fields and QC-specific data
 */
const qaMachineEntrySchema = new Schema<IQAMachineEntry>(
  {
    machine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: true,
    },
    added_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Machine fields (copied from machine creation)
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    subcategory_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    machine_sequence: {
      type: String,
      trim: true,
      default: null,
    },
    party_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    mobile_number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    dispatch_date: {
      type: Date,
      default: null,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    documents: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        file_path: {
          type: String,
          required: true,
          trim: true,
        },
        document_type: {
          type: String,
          trim: true,
        },
        uploaded_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // QC-specific fields
    qcNotes: {
      type: String,
      trim: true,
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    inspectionDate: {
      type: Date,
    },
    qc_date: {
      type: Date,
    },
    nextInspectionDate: {
      type: Date,
    },
    report_link: {
      type: String,
      required: false,
      trim: true,
    },
    files: [
      {
        type: String,
        trim: true,
      },
    ],

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    is_active: {
      type: Boolean,
      default: false,
      index: true,
    },
    approval_status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejection_reason: {
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
qaMachineEntrySchema.index({ machine_id: 1, createdAt: -1 });
qaMachineEntrySchema.index({ added_by: 1, createdAt: -1 });
qaMachineEntrySchema.index({ is_active: 1, createdAt: -1 });
qaMachineEntrySchema.index({ approval_status: 1, createdAt: -1 });
qaMachineEntrySchema.index({ category_id: 1 });
qaMachineEntrySchema.index({ party_name: 1 });
qaMachineEntrySchema.index({ qc_date: 1 });
qaMachineEntrySchema.index({ dispatch_date: 1 });

/**
 * Virtual to populate machine details
 */
qaMachineEntrySchema.virtual('machine', {
  ref: 'Machine',
  localField: 'machine_id',
  foreignField: '_id',
  justOne: true,
});

/**
 * Virtual to populate user details
 */
qaMachineEntrySchema.virtual('user', {
  ref: 'User',
  localField: 'added_by',
  foreignField: '_id',
  justOne: true,
});

/**
 * Ensure virtuals are included in JSON output
 */
qaMachineEntrySchema.set('toJSON', { virtuals: true });
qaMachineEntrySchema.set('toObject', { virtuals: true });

/**
 * Export the QA Machine Entry model
 */
export const QAMachineEntry = mongoose.model<IQAMachineEntry>(
  'QAMachineEntry',
  qaMachineEntrySchema,
);
