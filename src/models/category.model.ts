import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * ICategory interface defines the structure of a Category document with hierarchy support
 */
export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  parent_id?: mongoose.Types.ObjectId;
  level: number; // 0 = main category, 1 = subcategory, 2 = sub-subcategory
  is_active: boolean;
  sort_order: number;
  image_url?: string;
  seo_title?: string;
  seo_description?: string;
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * ISequenceManagement interface defines the structure of a Sequence Management document
 */
export interface ISequenceManagement extends Document {
  category_id: mongoose.Types.ObjectId;
  subcategory_id?: mongoose.Types.ObjectId;
  sequence_prefix: string;
  current_sequence: number;
  starting_number: number;
  format: string;
  is_active: boolean;
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

/**
 * Interface for Category model static methods
 */
export interface ICategoryModel extends Model<ICategory> {
  getCategoryTree(): Promise<ICategory[]>;
  buildTree(categories: ICategory[], parentId?: string | null): ICategory[];
  getCategoryPath(categoryId: string): Promise<string[]>;
  validateHierarchy(
    categoryId: string,
    newParentId: string | null,
  ): Promise<boolean>;
}

/**
 * Category Schema with hierarchy support
 */
const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9-]+$/,
        'Slug can only contain lowercase letters, numbers, and hyphens',
      ],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      validate: {
        validator: function (this: ICategory, value: mongoose.Types.ObjectId) {
          // Prevent self-reference
          if (
            value &&
            value.toString() === (this as ICategory)._id?.toString()
          ) {
            return false;
          }
          return true;
        },
        message: 'Category cannot be its own parent',
      },
    },
    level: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Level cannot be negative'],
      max: [3, 'Maximum hierarchy level is 3'],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    sort_order: {
      type: Number,
      default: 0,
      min: [0, 'Sort order cannot be negative'],
    },
    image_url: {
      type: String,
      trim: true,
      validate: {
        validator: function (value: string) {
          if (!value) return true;
          return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(value);
        },
        message: 'Image URL must be a valid image URL',
      },
    },
    seo_title: {
      type: String,
      trim: true,
      maxlength: [60, 'SEO title cannot exceed 60 characters'],
    },
    seo_description: {
      type: String,
      trim: true,
      maxlength: [160, 'SEO description cannot exceed 160 characters'],
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Sequence Management Schema
 */
const sequenceManagementSchema = new Schema<ISequenceManagement>(
  {
    category_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    subcategory_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    sequence_prefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: [10, 'Sequence prefix cannot exceed 10 characters'],
      match: [
        /^[A-Z0-9-]+$/,
        'Sequence prefix can only contain uppercase letters, numbers, and hyphens',
      ],
    },
    current_sequence: {
      type: Number,
      default: 0,
      min: [0, 'Current sequence cannot be negative'],
    },
    starting_number: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Starting number must be at least 1'],
    },
    format: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (value: string) {
          // Must contain placeholders for category, subcategory, and sequence
          return value.includes('{category}') && value.includes('{sequence}');
        },
        message: 'Format must contain {category} and {sequence} placeholders',
      },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Virtual for getting children categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent_id',
  justOne: false,
});

// Virtual for getting parent category
categorySchema.virtual('parent', {
  ref: 'Category',
  localField: 'parent_id',
  foreignField: '_id',
  justOne: true,
});

// Virtual for getting full path
categorySchema.virtual('full_path').get(function (this: ICategory) {
  return this.slug;
});

// Indexes for better performance
categorySchema.index({ parent_id: 1, level: 1, is_active: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ level: 1, sort_order: 1 });
categorySchema.index({ is_active: 1, created_at: -1 });
categorySchema.index({ deleted_at: 1 });

// Compound index for hierarchy queries
categorySchema.index({ parent_id: 1, level: 1, sort_order: 1, is_active: 1 });

// Unique compound index for sequence management
sequenceManagementSchema.index(
  { category_id: 1, subcategory_id: 1 },
  { unique: true, name: 'unique_category_subcategory' },
);

sequenceManagementSchema.index({ category_id: 1, is_active: 1 });
sequenceManagementSchema.index({ sequence_prefix: 1 });

// Pre-save middleware for category
categorySchema.pre('save', function (this: ICategory, next) {
  // Auto-generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Update level based on parent
  if (this.parent_id) {
    // Level will be set by the service layer based on parent's level
  } else {
    this.level = 0; // Root category
  }

  this.updated_at = new Date();
  next();
});

// Pre-save middleware for sequence management
sequenceManagementSchema.pre(
  'save',
  function (this: ISequenceManagement, next) {
    this.updated_at = new Date();
    next();
  },
);

// Static method to get category tree
(categorySchema.statics as Record<string, unknown>)['getCategoryTree'] =
  async function (this: ICategoryModel) {
    const categories = await this.find({ is_active: true, deleted_at: null })
      .populate('parent', 'name slug')
      .populate('created_by', 'username email')
      .sort({ level: 1, sort_order: 1, name: 1 });

    return this['buildTree'](categories);
  };

// Static method to build tree structure
(categorySchema.statics as Record<string, unknown>)['buildTree'] = function (
  this: ICategoryModel,
  categories: ICategory[],
  parentId: string | null = null,
): ICategory[] {
  const tree: ICategory[] = [];

  for (const category of categories) {
    const categoryParentId = category.parent_id
      ? category.parent_id.toString()
      : null;

    if (categoryParentId === parentId) {
      const children = this['buildTree'](
        categories,
        (category._id as string).toString(),
      );
      if (children.length > 0) {
        (category as ICategory & { children?: ICategory[] }).children =
          children;
      }
      tree.push(category);
    }
  }

  return tree;
};

// Static method to get category hierarchy path
(categorySchema.statics as Record<string, unknown>)['getCategoryPath'] =
  async function (this: ICategoryModel, categoryId: string): Promise<string[]> {
    const path: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category: ICategory | null =
        await this.findById(currentId).select('name parent_id');
      if (!category) break;

      path.unshift(category.name);
      currentId = category.parent_id ? category.parent_id.toString() : null;
    }

    return path;
  };

// Static method to validate hierarchy
(categorySchema.statics as Record<string, unknown>)['validateHierarchy'] =
  async function (
    this: ICategoryModel,
    categoryId: string,
    newParentId: string | null,
  ): Promise<boolean> {
    if (!newParentId) return true; // Root level is always valid

    // Check if new parent exists and is active
    const newParent = await this.findOne({
      _id: newParentId,
      is_active: true,
      deleted_at: null,
    });
    if (!newParent) return false;

    // Check for circular reference
    let currentId: string | null = newParentId;
    while (currentId) {
      if (currentId === categoryId) return false; // Circular reference detected

      const parent: ICategory | null =
        await this.findById(currentId).select('parent_id');
      currentId = parent?.parent_id ? parent.parent_id.toString() : null;
    }

    return true;
  };

/**
 * Export the models
 */
export const Category = mongoose.model<ICategory, ICategoryModel>(
  'Category',
  categorySchema,
);
export const SequenceManagement = mongoose.model<ISequenceManagement>(
  'SequenceManagement',
  sequenceManagementSchema,
);
