import mongoose from 'mongoose';
import { User } from '../../../models/user.model';
import { Role } from '../../../models/role.model';
import { NotificationType } from '../../../models/notification.model';
import notificationEmitter from '../services/notificationEmitter.service';

/**
 * Get users by role IDs
 */
export async function getUsersByRoleIds(roleIds: string[]): Promise<string[]> {
  try {
    if (!roleIds || roleIds.length === 0) {
      // Fallback: get admin users
      const adminRole = await Role.findOne({ name: 'admin' }).select('_id');
      if (!adminRole) return [];
      const adminUsers = await User.find({ role: adminRole._id })
        .select('_id')
        .lean();
      return adminUsers.map((u) => {
        const userId = u._id;
        return typeof userId === 'string'
          ? userId
          : (userId as mongoose.Types.ObjectId).toString();
      });
    }

    const users = await User.find({ role: { $in: roleIds } })
      .select('_id')
      .lean();
    return users.map((u) => {
      const userId = u._id;
      return typeof userId === 'string'
        ? userId
        : (userId as mongoose.Types.ObjectId).toString();
    });
  } catch (error) {
    console.error('Error getting users by role IDs:', error);
    // Fallback: get admin users
    const adminRole = await Role.findOne({ name: 'admin' }).select('_id');
    if (!adminRole) return [];
    const adminUsers = await User.find({ role: adminRole._id })
      .select('_id')
      .lean();
    return adminUsers.map((u) => {
      const userId = u._id;
      return typeof userId === 'string'
        ? userId
        : (userId as mongoose.Types.ObjectId).toString();
    });
  }
}

/**
 * Emit notification to approvers when machine is created
 */
export async function notifyMachineCreated(
  machineId: string,
  machineName: string,
  requesterId: string,
  requesterName: string,
  approverRoleIds: string[],
): Promise<void> {
  try {
    const approverUserIds = await getUsersByRoleIds(approverRoleIds);

    if (approverUserIds.length === 0) {
      console.warn('No approver users found for machine creation notification');
      return;
    }

    await notificationEmitter.createAndEmitToMultipleUsers(approverUserIds, {
      senderId: requesterId,
      type: NotificationType.MACHINE_CREATED,
      title: 'New Machine Created',
      message: `${requesterName} created a new machine "${machineName}" that requires approval`,
      relatedEntityType: 'machine',
      relatedEntityId: machineId,
      actionUrl: '/dispatch/approvals',
      actionLabel: 'View Approval',
      metadata: {
        machineId,
        machineName,
        requesterId,
        requesterName,
      },
    });
  } catch (error) {
    console.error('Error emitting machine created notification:', error);
  }
}

/**
 * Emit notification to requester when machine is approved
 */
export async function notifyMachineApproved(
  machineId: string,
  machineName: string,
  requesterId: string,
  approverId: string,
  approverName: string,
): Promise<void> {
  try {
    await notificationEmitter.createAndEmitNotification({
      recipientId: requesterId,
      senderId: approverId,
      type: NotificationType.MACHINE_APPROVED,
      title: 'Machine Approved',
      message: `${approverName} approved your machine "${machineName}"`,
      relatedEntityType: 'machine',
      relatedEntityId: machineId,
      actionUrl: '/dispatch/machines',
      actionLabel: 'View Machine',
      metadata: {
        machineId,
        machineName,
        approverId,
        approverName,
      },
    });
  } catch (error) {
    console.error('Error emitting machine approved notification:', error);
  }
}

/**
 * Emit notification to requester when machine is rejected
 */
export async function notifyMachineRejected(
  machineId: string,
  machineName: string,
  requesterId: string,
  approverId: string,
  approverName: string,
  rejectionReason: string,
): Promise<void> {
  try {
    await notificationEmitter.createAndEmitNotification({
      recipientId: requesterId,
      senderId: approverId,
      type: NotificationType.MACHINE_REJECTED,
      title: 'Machine Rejected',
      message: `${approverName} rejected your machine "${machineName}"`,
      relatedEntityType: 'machine',
      relatedEntityId: machineId,
      actionUrl: '/dispatch/machines',
      actionLabel: 'View Machine',
      metadata: {
        machineId,
        machineName,
        approverId,
        approverName,
        rejectionReason,
      },
    });
  } catch (error) {
    console.error('Error emitting machine rejected notification:', error);
  }
}
