import mongoose, { Schema, Document } from 'mongoose';

/**
 * Document interface for SO documentation
 */
export interface ISODocument {
  name: string;
  file_path: string;
  document_type?: string;
  uploaded_at: Date;
}

/**
 * ISO interface defines the structure of a SO document
 */
export interface ISO extends Document {
  name?: string; // Optional, can be removed
  customer: string; // Alphanumerical format like "T0037 - fsnf skfsfn sfksn"
  location: string;
  po_number: string; // Alphanumerical with special symbols
  po_date: Date; // DD/MM/YYYY format
  so_number: string; // Same type as P.O. Number
  so_date: Date; // Same format as P.O. Date
  items: Array<{
    no: number;
    item_code: string;
    item_details: string;
    uom: string;
    quantity: number;
    delivery_schedule?: Date;
    total?: number;
  }>;
  category_id: mongoose.Types.ObjectId;
  subcategory_id?: mongoose.Types.ObjectId;
  party_name: string;
  mobile_number: string;
  documents: ISODocument[];
  description: string;
  is_active: boolean;
  created_by: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * SO Schema
 */
const soSchema = new Schema<ISO>(
  {
    name: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
    },
    customer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    po_number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    po_date: {
      type: Date,
      required: true,
    },
    so_number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    so_date: {
      type: Date,
      required: true,
    },
    items: {
      type: [
        {
          no: {
            type: Number,
            required: false,
          },
          item_code: {
            type: String,
            required: false,
            trim: true,
            maxlength: 100,
          },
          item_details: {
            type: String,
            required: false,
            trim: true,
            maxlength: 500,
          },
          uom: {
            type: String,
            required: false,
            trim: true,
            maxlength: 50,
          },
          quantity: {
            type: Number,
            required: false,
            min: 0,
          },
          delivery_schedule: {
            type: Date,
            required: false,
          },
          total: {
            type: Number,
            required: false,
            min: 0,
          },
        },
      ],
      required: false,
      default: [],
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
    party_name: {
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
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Validate documents array length (max 10)
 */
soSchema.pre('save', function (next) {
  if (this.documents && this.documents.length > 10) {
    return next(new Error('Maximum 10 documents allowed'));
  }
  next();
});

/**
 * Index for soft delete queries
 */
soSchema.index({ deletedAt: 1 });

/**
 * Index for name queries
 */
soSchema.index({ name: 1 });

/**
 * Index for category-based queries
 */
soSchema.index({ category_id: 1 });

/**
 * Index for subcategory-based queries
 */
soSchema.index({ subcategory_id: 1 });

/**
 * Index for party name queries
 */
soSchema.index({ party_name: 1 });

/**
 * Index for active status queries
 */
soSchema.index({ is_active: 1 });

/**
 * Index for creator-based queries
 */
soSchema.index({ created_by: 1 });

/**
 * Compound index for active SOs by category
 */
soSchema.index({ category_id: 1, is_active: 1, deletedAt: 1 });

/**
 * Virtual to check if SO is deleted
 */
soSchema.virtual('isDeleted').get(function () {
  return this.deletedAt !== null;
});

/**
 * Virtual to check if SO is active (not deleted and is_active)
 */
soSchema.virtual('isActive').get(function () {
  return this.deletedAt === null && this.is_active === true;
});

/**
 * Query middleware to exclude deleted documents by default
 */
soSchema.pre(/^find/, function (this: mongoose.Query<unknown, ISO>) {
  // Only apply this middleware if deletedAt filter isn't explicitly set
  const query = this.getQuery() as { deletedAt?: Date | null };
  if (query.deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
});

/**
 * Instance method to soft delete SO
 */
soSchema.methods['softDelete'] = function (deletedBy: mongoose.Types.ObjectId) {
  this['deletedAt'] = new Date();
  this['updatedBy'] = deletedBy;
  return this['save']();
};

/**
 * Instance method to restore soft deleted SO
 */
soSchema.methods['restore'] = function (restoredBy: mongoose.Types.ObjectId) {
  this['deletedAt'] = null;
  this['updatedBy'] = restoredBy;
  return this['save']();
};

/**
 * Static method to find with deleted documents
 */
soSchema.statics['findWithDeleted'] = function () {
  return this.find({});
};

/**
 * Static method to find only deleted documents
 */
soSchema.statics['findDeleted'] = function () {
  return this.find({ deletedAt: { $ne: null } });
};

/**
 * Export the SO model
 */
export const SO = mongoose.model<ISO>('SO', soSchema);
