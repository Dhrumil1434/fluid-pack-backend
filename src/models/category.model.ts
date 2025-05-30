import mongoose, { Schema, Document } from 'mongoose';

/**
 * ICategory interface defines the structure of a Category document
 */
export interface ICategory extends Document {
  name: string;
  description: string;
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
  },
  {
    timestamps: true,
  },
);

/**
 * Export the Category model
 */
export const Category = mongoose.model<ICategory>('Category', categorySchema);
