/**
 * Server-side authorization rules. The UI hides controls for convenience;
 * THIS file is what actually enforces access. Every route goes through it.
 */
import type { Application, User } from './types';

const EDITABLE = new Set(['DRAFT', 'INFO_REQUESTED']);

export const policy = {
  canView(user: User, app: Application): boolean {
    switch (user.role) {
      case 'ADMIN':
        return true;
      case 'SALES':
        return app.createdById === user.id;
      case 'REVIEWER':
        return app.assignedReviewerId === user.id;
    }
  },

  canCreate(user: User): boolean {
    return user.role === 'SALES';
  },

  canEdit(user: User, app: Application): boolean {
    return user.role === 'SALES' && app.createdById === user.id && EDITABLE.has(app.status);
  },

  canDecide(user: User, app: Application): boolean {
    return (
      user.role === 'REVIEWER' && app.assignedReviewerId === user.id && app.status === 'IN_REVIEW'
    );
  },

  canAssign(user: User, app: Application): boolean {
    return user.role === 'ADMIN' && ['SUBMITTED', 'IN_REVIEW'].includes(app.status);
  },

  canRevealSensitive(user: User, app: Application): boolean {
    return (
      user.role === 'ADMIN' || (user.role === 'REVIEWER' && app.assignedReviewerId === user.id)
    );
  },
};
