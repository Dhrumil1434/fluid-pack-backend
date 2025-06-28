import mongoose, { Schema, Document } from 'mongoose';

/**
 * IQAMachineEntry interface defines the structure of a QA Machine Entry document
 */
export interface IQAMachineEntry extends Document {
  machine_id: mongoose.Types.ObjectId;
  added_by: mongoose.Types.ObjectId;
  report_link: string;
  files: string[]; // Array of file URLs/paths for uploaded documents
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * QA Machine Entry Schema
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
    report_link: {
      type: String,
      required: true,
      trim: true,
    },
    files: [
      {
        type: String,
        trim: true,
      },
    ],
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