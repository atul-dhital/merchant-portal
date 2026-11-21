export type Role = 'SALES' | 'REVIEWER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type ApplicationStatus =
  'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED';

export type Decision = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Owner {
  fullName: string;
  dateOfBirth: string;
  ownershipPercent: number | null;
  /** Sensitive. */
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
    /** Sensitive. */
    accountNumber: string;
    routingCode: string;
    expectedMonthlyVolume: number | null;
    averageTicketSize: number | null;
  };
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

export interface Application {
  id: string;
  reference: string;
  status: ApplicationStatus;
  createdById: string;
  assignedReviewerId: string | null;
  createdAt: string;
  updatedAt: string;
  data: ApplicationData;
  history: HistoryEvent[];
}
