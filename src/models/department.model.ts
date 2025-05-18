import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  description?: string;
}
export interface IDepartmentModel extends Model<IDepartment> {
  isNameTaken(name: string): Promise<boolean>;
}

const departmentSchema = new Schema<IDepartment>(
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

// ✅ Static method to check if name is taken

departmentSchema.statics['isNameTaken'] = async function (name: string) {
  const department = await this.findOne({ name: name.toLowerCase().trim() });
  return !!department;
};

export const Department = mongoose.model<IDepartment, IDepartmentModel>(
  'Department',
  departmentSchema,
);
