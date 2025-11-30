/**
 * Utility to sanitize machine response data
 * Ensures null populated fields don't cause frontend errors
 */
import { IMachine } from '../models/machine.model';
import mongoose from 'mongoose';

interface PopulatedCategory {
  _id?: mongoose.Types.ObjectId | string | null;
  name?: string;
  description?: string;
  slug?: string;
}

interface PopulatedUser {
  _id?: mongoose.Types.ObjectId | string | null;
  username?: string;
  email?: string;
  name?: string;
}

interface SanitizedMachine
  extends Omit<
    IMachine,
    'category_id' | 'subcategory_id' | 'created_by' | 'updatedBy'
  > {
  category_id: PopulatedCategory | mongoose.Types.ObjectId | string | null;
  subcategory_id: PopulatedCategory | mongoose.Types.ObjectId | string | null;
  created_by: PopulatedUser | mongoose.Types.ObjectId | string | null;
  updatedBy?: PopulatedUser | mongoose.Types.ObjectId | string | null;
}

// Type for machine input (can be Mongoose document or plain object from lean())
type MachineInput =
  | (IMachine & {
      category_id?: PopulatedCategory | mongoose.Types.ObjectId | string | null;
      subcategory_id?:
        | PopulatedCategory
        | mongoose.Types.ObjectId
        | string
        | null;
      created_by?: PopulatedUser | mongoose.Types.ObjectId | string | null;
      updatedBy?: PopulatedUser | mongoose.Types.ObjectId | string | null;
      toObject?: () => Record<string, unknown>;
    })
  | Record<string, unknown>
  | null
  | undefined;

/**
 * Sanitize a single machine object to ensure populated fields are safe
 */
export const sanitizeMachine = (machine: MachineInput): SanitizedMachine => {
  if (!machine) {
    throw new Error('Machine cannot be null or undefined');
  }

  // Convert to plain object if it's a Mongoose document
  const machineObj =
    typeof machine === 'object' &&
    'toObject' in machine &&
    typeof machine.toObject === 'function'
      ? (machine.toObject() as Record<string, unknown>)
      : ({ ...machine } as Record<string, unknown>);

  // Handle category_id - ensure it has a name property even if null
  if (machineObj.category_id) {
    if (
      typeof machineObj.category_id === 'object' &&
      machineObj.category_id !== null
    ) {
      // Already populated - ensure name exists
      if (!machineObj.category_id.name) {
        machineObj.category_id = {
          _id: machineObj.category_id._id,
          name: 'Unknown Category',
          description: machineObj.category_id.description || '',
          slug: machineObj.category_id.slug || '',
        };
      }
    }
  } else {
    // If null or undefined, provide a safe default object to prevent frontend errors
    machineObj.category_id = {
      _id: null,
      name: 'Unknown Category',
      description: '',
      slug: '',
    };
  }

  // Handle subcategory_id - ensure it has a name property even if null
  if (machineObj.subcategory_id) {
    if (
      typeof machineObj.subcategory_id === 'object' &&
      machineObj.subcategory_id !== null
    ) {
      // Already populated - ensure name exists
      if (!machineObj.subcategory_id.name) {
        machineObj.subcategory_id = {
          _id: machineObj.subcategory_id._id,
          name: 'Unknown Subcategory',
          description: machineObj.subcategory_id.description || '',
          slug: machineObj.subcategory_id.slug || '',
        };
      }
    }
  } else {
    // If null or undefined, provide a safe default object to prevent frontend errors
    machineObj.subcategory_id = {
      _id: null,
      name: 'Unknown Subcategory',
      description: '',
      slug: '',
    };
  }

  // Handle created_by - ensure it has required properties
  if (machineObj.created_by) {
    if (
      typeof machineObj.created_by === 'object' &&
      machineObj.created_by !== null
    ) {
      // Already populated - ensure username exists
      if (!machineObj.created_by.username && !machineObj.created_by.name) {
        machineObj.created_by = {
          _id: machineObj.created_by._id,
          username: 'Unknown User',
          email: machineObj.created_by.email || '',
        };
      }
    }
  } else {
    // If null or undefined, provide a safe default object to prevent frontend errors
    machineObj.created_by = {
      _id: null,
      username: 'Unknown User',
      email: '',
    };
  }

  // Handle updatedBy - ensure it has required properties (optional field)
  if (machineObj.updatedBy) {
    if (
      typeof machineObj.updatedBy === 'object' &&
      machineObj.updatedBy !== null
    ) {
      // Already populated - ensure username exists
      if (!machineObj.updatedBy.username && !machineObj.updatedBy.name) {
        machineObj.updatedBy = {
          _id: machineObj.updatedBy._id,
          username: 'Unknown User',
          email: machineObj.updatedBy.email || '',
        };
      }
    }
  } else {
    // updatedBy is optional, so null is acceptable
    machineObj.updatedBy = null;
  }

  return machineObj as SanitizedMachine;
};

/**
 * Sanitize an array of machines
 */
export const sanitizeMachines = (
  machines: MachineInput[],
): SanitizedMachine[] => {
  if (!Array.isArray(machines)) return [];
  return machines.map((machine) => sanitizeMachine(machine));
};
