export type ApplicationStatus =
  'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
];

export const STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  INFO_REQUESTED: 'Info requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export type Decision = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export const DECISION_LABELS: Readonly<Record<Decision, string>> = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  REQUEST_INFO: 'Request more information',
};

export interface Owner {
  fullName: string;
  dateOfBirth: string;
  ownershipPercent: number | null;
  nationalId: string;
}

export interface ApplicationData {
  business: {
    legalName: string;
    tradingName: string;
    businessType: string;
    registrationNumber: string;
    incorporationDate: string;
    website: string;
    category: string;
  };
  contact: {
    contactName: string;
    email: string;
    phone: string;
    addressLine1: string;
    city: string;
    country: string;
    postalCode: string;
  };
  owners: Owner[];
  banking: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    routingCode: string;
    expectedMonthlyVolume: number | null;
    averageTicketSize: number | null;
  };
}

export interface ApplicationSummary {
  id: string;
  reference: string;
  status: ApplicationStatus;
  legalName: string;
  tradingName: string;
  country: string;
  createdById: string;
  createdByName: string | null;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEvent {
  id: string;
  at: string;
  type: 'CREATED' | 'SUBMITTED' | 'ASSIGNED' | 'DECISION' | 'SENSITIVE_REVEALED';
  actorName: string;
  decision?: Decision;
  riskLevel?: RiskLevel;
  notes?: string;
  reviewerName?: string;
  field?: string;
}

/** Detail payload: sensitive fields arrive already masked by the server. */
export interface ApplicationDetail extends ApplicationSummary {
  data: ApplicationData;
  history: HistoryEvent[];
}

/** Editable draft: full values, only returned to the author while editable. */
export interface ApplicationDraft {
  id: string;
  reference: string;
  status: ApplicationStatus;
  data: ApplicationData;
}

export interface SaveResult {
  id: string;
  reference: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatusCounts {
  total: number;
  byStatus: Partial<Record<ApplicationStatus, number>>;
}

export interface ApplicationQuery {
  page: number;
  pageSize: number;
  status: ApplicationStatus | '';
  q: string;
}

export interface DecisionRequest {
  decision: Decision;
  riskLevel: RiskLevel;
  notes: string;
}

export type SensitiveField = 'banking.accountNumber' | `owners.${number}.nationalId`;

export const sensitiveFieldLabel = (field: string): string =>
  field === 'banking.accountNumber'
    ? 'bank account number'
    : field.startsWith('owners.')
      ? `owner ${Number(field.split('.')[1]) + 1} national ID`
      : field;
