// permissionConfig.model.ts

import mongoose, { Schema, Document } from 'mongoose';

/**
 * Permission types for different actions
 */
export enum ActionType {
  CREATE_MACHINE = 'CREATE_MACHINE',
  EDIT_MACHINE = 'EDIT_MACHINE',
  DELETE_MACHINE = 'DELETE_MACHINE',
  APPROVE_MACHINE = 'APPROVE_MACHINE',
}

/**
 * Permission levels
 */
export enum PermissionLevel {
  ALLOWED = 'ALLOWED', // Direct permission
  REQUIRES_APPROVAL = 'REQUIRES_APPROVAL', // Needs approval
  DENIED = 'DENIED', // Not allowed
}

/**
 * IPermissionConfig interface defines the structure of permission configuration
 */
export interface IPermissionConfig extends Document {
  name: string;
  description: string;
  action: ActionType;

  // Rule conditions
  roleIds?: mongoose.Types.ObjectId[]; // Specific roles
  userIds?: mongoose.Types.ObjectId[]; // Specific users
  departmentIds?: mongoose.Types.ObjectId[]; // Specific departments

  // Machine-specific conditions
  categoryIds?: mongoose.Types.ObjectId[]; // Specific machine categories

  // Permission level
  permission: PermissionLevel;

  // Additional metadata for approval workflow
  approverRoles?: mongoose.Types.ObjectId[]; // Who can approve this action
  maxValue?: number; // For value-based rules (e.g., machine cost)

  isActive: boolean;
  priority: number; // Higher number = higher priority

  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Permission Configuration Schema
 */
const permissionConfigSchema = new Schema<IPermissionConfig>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      enum: Object.values(ActionType),
      required: true,
    },
    roleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    departmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    permission: {
      type: String,
      enum: Object.values(PermissionLevel),
      required: true,
    },
    approverRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    maxValue: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Index for efficient permission queries
 */
permissionConfigSchema.index({ action: 1, isActive: 1, priority: -1 });
permissionConfigSchema.index({ roleIds: 1, action: 1 });
permissionConfigSchema.index({ userIds: 1, action: 1 });

export const PermissionConfig = mongoose.model<IPermissionConfig>(
  'PermissionConfig',
  permissionConfigSchema,
);
