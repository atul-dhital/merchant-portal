export type Role = 'SALES' | 'REVIEWER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/**
 * The UI checks permissions, never raw roles. Ownership/assignment rules
 * (e.g. "only the assigned reviewer") live in application-policy.ts.
 */
export type Permission =
  | 'application:create'
  | 'application:edit'
  | 'application:review'
  | 'application:assign'
  | 'application:view-all'
  | 'sensitive:reveal';

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  SALES: ['application:create', 'application:edit'],
  REVIEWER: ['application:review', 'sensitive:reveal'],
  ADMIN: ['application:view-all', 'application:assign', 'sensitive:reveal'],
};

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  SALES: 'Sales',
  REVIEWER: 'Reviewer',
  ADMIN: 'Admin',
};

/**
 * How each account type is presented (sign-in cards, sidebar). The abilities
 * describe what mock-api/src/policy.ts actually allows; keep them in sync.
 */
export interface RoleInfo {
  label: string;
  icon: 'file' | 'check' | 'shield';
  summary: string;
  abilities: readonly string[];
}

export const ROLE_ORDER: readonly Role[] = ['SALES', 'REVIEWER', 'ADMIN'];

export const ROLE_INFO: Readonly<Record<Role, RoleInfo>> = {
  SALES: {
    label: 'Sales',
    icon: 'file',
    summary: 'Create merchant applications and track their review.',
    abilities: [
      'Create and edit your own applications',
      'Drafts save automatically',
      'Respond when a reviewer asks for more information',
    ],
  },
  REVIEWER: {
    label: 'Reviewer',
    icon: 'check',
    summary: 'Review the applications assigned to you and record risk decisions.',
    abilities: [
      'See only applications assigned to you',
      'Approve, reject or request more information',
      'Reveal masked bank and ID numbers (audited)',
    ],
  },
  ADMIN: {
    label: 'Admin',
    icon: 'shield',
    summary: 'See every application and assign reviewers.',
    abilities: [
      'See all applications',
      'Assign and reassign reviewers',
      'Reveal masked bank and ID numbers (audited)',
    ],
  },
};
