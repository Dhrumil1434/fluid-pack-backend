import mongoose, { Schema, Document } from 'mongoose';

/**
 * ICategory interface defines the structure of a Category document
 */
export interface ICategory extends Document {
  name: string;
  description: string;
  createdBy: mongoose.Types.ObjectId; // Added createdBy field
  isActive?: boolean; // Optional: for soft deletes
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Category Schema
 */
const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Assuming you have a User model
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true, // For soft deletes
    },
  },
  {
    timestamps: true,
  },
);

// Add indexes for better performance
categorySchema.index({ name: 1 });
categorySchema.index({ createdBy: 1 });
categorySchema.index({ isActive: 1 });

// Add a compound index for common queries
categorySchema.index({ isActive: 1, createdAt: -1 });

/**
 * Export the Category model
 */
export const Category = mongoose.model<ICategory>('Category', categorySchema);
