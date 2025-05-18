import mongoose, { Schema, Document, Model } from 'mongoose';

// 👉 Interface for instance methods (document fields)
export interface IRole extends Document {
  name: string;
  description?: string;
}

// 👉 Interface for static methods
export interface IRoleModel extends Model<IRole> {
  isNameTaken(name: string): Promise<boolean>;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// 👉 Define static method on schema

roleSchema.statics['isNameTaken'] = async function (name: string) {
  const role = await this.findOne({ name: name.toLowerCase().trim() });
  return !!role;
};

// 👉 Export the model with correct typing
export const Role = mongoose.model<IRole, IRoleModel>('Role', roleSchema);
