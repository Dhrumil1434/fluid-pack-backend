import mongoose, { Schema, Document } from 'mongoose';

/**
 * Document interface for machine documentation
 */
export interface IDocument {
  name: string;
  file_path: string;
  document_type?: string;
  uploaded_at: Date;
}

/**
 * IMachine interface defines the structure of a Machine document
 */
export interface IMachine extends Document {
  name: string;
  nameHash?: string | null;
  category_id: mongoose.Types.ObjectId;
  subcategory_id?: mongoose.Types.ObjectId; // New field for subcategory
  machine_sequence?: string; // New field for generated sequence
  created_by: mongoose.Types.ObjectId;
  is_approved: boolean;
  images: string[]; // Array of image URLs/paths
  documents: IDocument[]; // Array of document objects with names and paths
  party_name: string; // Party/Company name
  location: string; // City-Country or location
  mobile_number: string; // Contact mobile number
  dispatch_date?: Date; // Dispatch date for the machine
  updatedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Machine Schema
 */
const machineSchema = new Schema<IMachine>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameHash: {
      type: String,
      default: null,
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
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    is_approved: {
      type: Boolean,
      default: false,
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Index for soft delete queries
 */
machineSchema.index({ deletedAt: 1 });

/**
 * Index for category-based queries
 */
machineSchema.index({ category_id: 1 });

/**
 * Index for subcategory-based queries
 */
machineSchema.index({ subcategory_id: 1 });

/**
 * Index for machine sequence queries
 */
machineSchema.index({ machine_sequence: 1 });

/**
 * Index for approval status queries
 */
machineSchema.index({ is_approved: 1 });

/**
 * Index for creator-based queries
 */
machineSchema.index({ created_by: 1 });

/**
 * Compound index for active approved machines by category
 */
machineSchema.index({ category_id: 1, is_approved: 1, deletedAt: 1 });

/**
 * Compound index for machines by category and subcategory
 */
machineSchema.index({
  category_id: 1,
  subcategory_id: 1,
  is_approved: 1,
  deletedAt: 1,
});

/**
 * Index for party name queries
 */
machineSchema.index({ party_name: 1 });

/**
 * Index for location-based queries
 */
machineSchema.index({ location: 1 });

/**
 * Index for mobile number queries
 */
machineSchema.index({ mobile_number: 1 });

/**
 * Virtual to check if machine is deleted
 */
machineSchema.virtual('isDeleted').get(function () {
  return this.deletedAt !== null;
});

/**
 * Virtual to check if machine is active (not deleted and approved)
 */
machineSchema.virtual('isActive').get(function () {
  return this.deletedAt === null && this.is_approved === true;
});

/**
 * Query middleware to exclude deleted documents by default
 */
machineSchema.pre(/^find/, function (this: mongoose.Query<unknown, IMachine>) {
  // Only apply this middleware if deletedAt filter isn't explicitly set
  const query = this.getQuery() as { deletedAt?: Date | null };
  if (query.deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
});

/**
 * Instance method to soft delete machine
 */
/**
 * Instance method to soft delete machine
 */
machineSchema.methods['softDelete'] = function (
  deletedBy: mongoose.Types.ObjectId,
) {
  this['deletedAt'] = new Date();
  this['updatedBy'] = deletedBy;
  return this['save']();
};

/**
 * Instance method to restore soft deleted machine
 */
/**
 * Instance method to restore soft deleted machine
 */
machineSchema.methods['restore'] = function (
  restoredBy: mongoose.Types.ObjectId,
) {
  this['deletedAt'] = null;
  this['updatedBy'] = restoredBy;
  return this['save']();
};

/**
 * Static method to find with deleted documents
 */
/**
 * Static method to find with deleted documents
 */
machineSchema.statics['findWithDeleted'] = function () {
  return this.find({});
};

/**
 * Static method to find only deleted documents
 */
/**
 * Static method to find only deleted documents
 */
machineSchema.statics['findDeleted'] = function () {
  return this.find({ deletedAt: { $ne: null } });
};

/**
 * Export the Machine model
 */
export const Machine = mongoose.model<IMachine>('Machine', machineSchema);
