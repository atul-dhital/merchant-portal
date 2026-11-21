import { User } from '../../../core/auth/auth.models';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApplicationSummary } from './application.models';

/**
 * Per-application UI permissions = role permission + ownership/assignment + status.
 * Mirrors mock-api/src/policy.ts. The UI uses it only to decide what to SHOW;
 * the API enforces the same rules independently.
 */
export interface ApplicationActions {
  canEdit: boolean;
  canDecide: boolean;
  canAssign: boolean;
  canReveal: boolean;
}

const EDITABLE = new Set(['DRAFT', 'INFO_REQUESTED']);

export function applicationActions(auth: AuthStore, app: ApplicationSummary): ApplicationActions {
  const user: User | null = auth.user();
  if (!user) return { canEdit: false, canDecide: false, canAssign: false, canReveal: false };

  const isAssignedReviewer = app.assignedReviewerId === user.id;
  return {
    canEdit:
      auth.can('application:edit') && app.createdById === user.id && EDITABLE.has(app.status),
    canDecide: auth.can('application:review') && isAssignedReviewer && app.status === 'IN_REVIEW',
    canAssign: auth.can('application:assign') && ['SUBMITTED', 'IN_REVIEW'].includes(app.status),
    canReveal:
      auth.can('sensitive:reveal') && (auth.can('application:view-all') || isAssignedReviewer),
  };
}
