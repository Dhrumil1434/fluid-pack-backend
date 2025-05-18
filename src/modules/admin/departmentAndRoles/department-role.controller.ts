import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { Department } from '../../../models/department.model';
import { Role } from '../../../models/role.model';
import { ApiResponse } from '../../../utils/ApiResponse';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../../utils/ApiError';

class DepartmentAndRoleController {
  // ---------- Department CRUD ----------

  static createDepartment = asyncHandler(
    async (req: Request, res: Response) => {
      const { name, description } = req.body;

      if (await Department.isNameTaken(name)) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'CREATE_DEPARTMENT',
          'ALREADY_EXISTS',
        );
      }

      const department = await Department.create({ name, description });

      res
        .status(StatusCodes.CREATED)
        .json(
          new ApiResponse(
            StatusCodes.CREATED,
            department,
            'Department created successfully',
          ),
        );
    },
  );

  static getAllDepartments = asyncHandler(
    async (_req: Request, res: Response) => {
      const departments = await Department.find();
      res.json(
        new ApiResponse(StatusCodes.OK, departments, 'All departments fetched'),
      );
    },
  );

  static getDepartmentById = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      const department = await Department.findById(id);
      if (!department) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          'GET_DEPARTMENT',
          'NOT_FOUND',
        );
      }

      res.json(new ApiResponse(StatusCodes.OK, department, 'Department found'));
    },
  );

  static updateDepartment = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { name, description } = req.body;

      // Check if another department with the same name exists
      const existing = await Department.findOne({ name, _id: { $ne: id } });
      if (existing) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'UPDATE_DEPARTMENT',
          'ALREADY_EXISTS',
        );
      }

      const department = await Department.findByIdAndUpdate(
        id,
        { name, description },
        { new: true },
      );

      if (!department) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          'UPDATE_DEPARTMENT',
          'NOT_FOUND',
        );
      }

      res.json(
        new ApiResponse(
          StatusCodes.OK,
          department,
          'Department updated successfully',
        ),
      );
    },
  );

  static deleteDepartment = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      const department = await Department.findByIdAndDelete(id);
      if (!department) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          'DELETE_DEPARTMENT',
          'NOT_FOUND',
        );
      }

      res.json(
        new ApiResponse(
          StatusCodes.OK,
          department,
          'Department deleted successfully',
        ),
      );
    },
  );

  // ---------- Role CRUD ----------

  static createRole = asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;

    if (await Role.isNameTaken(name)) {
      throw new ApiError(StatusCodes.CONFLICT, 'CREATE_ROLE', 'ALREADY_EXISTS');
    }

    const role = await Role.create({ name, description });

    res
      .status(StatusCodes.CREATED)
      .json(
        new ApiResponse(StatusCodes.CREATED, role, 'Role created successfully'),
      );
  });

  static getAllRoles = asyncHandler(async (_req: Request, res: Response) => {
    const roles = await Role.find();
    res.json(new ApiResponse(StatusCodes.OK, roles, 'All roles fetched'));
  });

  static getRoleById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'GET_ROLE', 'NOT_FOUND');
    }

    res.json(new ApiResponse(StatusCodes.OK, role, 'Role found'));
  });

  static updateRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if another role with the same name already exists
    const existing = await Role.findOne({ name, _id: { $ne: id } });
    if (existing) {
      throw new ApiError(StatusCodes.CONFLICT, 'UPDATE_ROLE', 'ALREADY_EXISTS');
    }

    const role = await Role.findByIdAndUpdate(
      id,
      { name, description },
      { new: true },
    );

    if (!role) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'UPDATE_ROLE', 'NOT_FOUND');
    }

    res.json(
      new ApiResponse(StatusCodes.OK, role, 'Role updated successfully'),
    );
  });

  static deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const role = await Role.findByIdAndDelete(id);
    if (!role) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'DELETE_ROLE', 'NOT_FOUND');
    }

    res.json(
      new ApiResponse(StatusCodes.OK, role, 'Role deleted successfully'),
    );
  });
}

export default DepartmentAndRoleController;
