import mongoose, { Schema, Document } from 'mongoose';
import {
  decryptObject,
  decryptString,
  encryptObject,
  encryptString,
  hmacDeterministic,
} from '../utils/crypto.util';

/**
 * IMachine interface defines the structure of a Machine document
 */
export interface IMachine extends Document {
  name: string;
  category_id: mongoose.Types.ObjectId;
  created_by: mongoose.Types.ObjectId;
  is_approved: boolean;
  images: string[]; // Array of image URLs/paths
  updatedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Machine Schema
 */
const machineSchema = new Schema<
  IMachine & { nameHash?: string; _isDecrypted?: boolean }
>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Deterministic hash of name for uniqueness and search without exposing plaintext
    nameHash: {
      type: String,
      index: true,
      select: false,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
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

// Enforce uniqueness of name within category even while name is encrypted
machineSchema.index(
  { category_id: 1, nameHash: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

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

// Encrypt fields before save
machineSchema.pre('save', function (this: IMachine & Document, next) {
  try {
    if (this.isModified('name')) {
      const plain = this.name;
      (this as unknown as { nameHash?: string }).nameHash = hmacDeterministic(
        String(plain).trim().toLowerCase(),
      );
      this.name = String(encryptString(String(plain)));
    }
    if (this.isModified('metadata')) {
      const meta = (this.metadata as Record<string, unknown>) || {};
      (this as unknown as { metadata: string }).metadata = encryptObject(meta);
    }
    next();
  } catch (e) {
    next(e as Error);
  }
});

// Decrypt fields after find queries (lean=false)
type DecryptableMachine = IMachine & {
  _isDecrypted?: boolean;
  name?: unknown;
  metadata?: unknown;
};

function decryptDoc<T extends DecryptableMachine | null | undefined>(
  doc: T,
): T {
  if (!doc || (doc as DecryptableMachine)._isDecrypted) return doc;
  try {
    if (typeof (doc as DecryptableMachine).name === 'string') {
      (doc as DecryptableMachine).name =
        decryptString((doc as DecryptableMachine).name as string) ?? '';
    }
    if (
      (doc as DecryptableMachine).metadata &&
      typeof (doc as DecryptableMachine).metadata === 'string'
    ) {
      (doc as DecryptableMachine).metadata = decryptObject(
        (doc as DecryptableMachine).metadata as unknown as string,
      );
    }
    Object.defineProperty(doc as object, '_isDecrypted', {
      value: true,
      enumerable: false,
    });
  } catch {
    // ignore decrypt errors to avoid crashing reads
  }
  return doc;
}

machineSchema.post('init', function (doc: DecryptableMachine) {
  decryptDoc(doc);
});

machineSchema.post('save', function (doc: DecryptableMachine) {
  decryptDoc(doc);
});

machineSchema.post('find', function (docs: DecryptableMachine[]) {
  docs.forEach(decryptDoc);
});

machineSchema.post('findOne', function (doc: DecryptableMachine | null) {
  decryptDoc(doc ?? undefined);
});

/**
 * Instance method to soft delete machine
 */
/**
 * Instance method to soft delete machine
 */
machineSchema.methods['softDelete'] = function (
  this: IMachine & Document,
  deletedBy: mongoose.Types.ObjectId,
) {
  this.deletedAt = new Date();
  this.updatedBy = deletedBy;
  return this.save();
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
