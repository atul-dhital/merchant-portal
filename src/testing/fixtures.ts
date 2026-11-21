import { User } from '../app/core/auth/auth.models';
import {
  ApplicationData,
  ApplicationDetail,
  ApplicationSummary,
} from '../app/features/applications/data-access/application.models';

export const SALES: User = { id: 'u-sales-1', name: 'Sam Sales', role: 'SALES' };
// Test-only second users (not demo accounts): prove that ownership and assignment rules hold.
export const OTHER_SALES: User = { id: 'u-sales-2', name: 'Other Sales', role: 'SALES' };
export const REVIEWER: User = { id: 'u-rev-1', name: 'Riya Reviewer', role: 'REVIEWER' };
export const OTHER_REVIEWER: User = { id: 'u-rev-2', name: 'Other Reviewer', role: 'REVIEWER' };
export const ADMIN: User = { id: 'u-admin-1', name: 'Ada Admin', role: 'ADMIN' };

export function summary(overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    id: 'app-001',
    reference: 'MA-2026-0001',
    status: 'IN_REVIEW',
    legalName: 'Test Merchant Pvt. Ltd.',
    tradingName: 'Test Merchant',
    country: 'NP',
    createdById: SALES.id,
    createdByName: SALES.name,
    assignedReviewerId: REVIEWER.id,
    assignedReviewerName: REVIEWER.name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export function applicationData(): ApplicationData {
  return {
    business: {
      legalName: 'Test Merchant Pvt. Ltd.',
      tradingName: 'Test Merchant',
      businessType: 'PRIVATE_LIMITED',
      registrationNumber: 'TEST-000001',
      incorporationDate: '2020-01-01',
      website: 'https://example.com',
      category: 'RETAIL',
    },
    contact: {
      contactName: 'Test Contact',
      email: 'contact@example.com',
      phone: '+9779800000000',
      addressLine1: '1 Example Street',
      city: 'Kathmandu',
      country: 'NP',
      postalCode: '44600',
    },
    owners: [
      {
        fullName: 'Test Owner',
        dateOfBirth: '1985-01-01',
        ownershipPercent: 100,
        nationalId: '•••• 0001',
      },
    ],
    banking: {
      bankName: 'Example Test Bank',
      accountHolder: 'Test Merchant Pvt. Ltd.',
      accountNumber: '•••• 1234',
      routingCode: 'TESTBANK01',
      expectedMonthlyVolume: 500000,
      averageTicketSize: 1500,
    },
  };
}

export function detail(overrides: Partial<ApplicationSummary> = {}): ApplicationDetail {
  return { ...summary(overrides), data: applicationData(), history: [] };
}
