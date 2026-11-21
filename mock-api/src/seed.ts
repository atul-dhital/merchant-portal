/**
 * Seed data. EVERYTHING here is fictional test data:
 * no real people, businesses, bank accounts or identity numbers.
 */
import type { Application, ApplicationStatus, User } from './types';

/** One demo account per account type. */
export const USERS: User[] = [
  { id: 'u-sales-1', name: 'Sam Sales', role: 'SALES' },
  { id: 'u-rev-1', name: 'Riya Reviewer', role: 'REVIEWER' },
  { id: 'u-admin-1', name: 'Ada Admin', role: 'ADMIN' },
];

const SALES_USER = USERS.find((u) => u.role === 'SALES')!;
const REVIEWER_USER = USERS.find((u) => u.role === 'REVIEWER')!;

const NAMES = [
  'Everest Test Traders',
  'Demo Coffee House',
  'Sample Hardware Store',
  'Placeholder Books',
  'Example Electronics',
  'Mock Mountain Gear',
  'Fictional Fashion',
  'Dummy Dairy Supplies',
  'Prototype Pharmacy',
  'Specimen Sports',
  'Trial Travel Agency',
  'Sandbox Stationery',
];
const STATUSES: ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
];

function pad(n: number, size: number): string {
  return String(n).padStart(size, '0');
}

export function buildSeed(): Application[] {
  const apps: Application[] = [];
  // Spread over roughly the last six months so the overview charts have data.
  const DAY = 86_400_000;
  const now = Date.now();

  for (let i = 1; i <= 36; i++) {
    const status = STATUSES[i % STATUSES.length];
    const owner = SALES_USER;
    const needsReviewer = ['IN_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED'].includes(status);
    const reviewer = needsReviewer ? REVIEWER_USER : null;
    // Irregular gaps (newest app last) so months differ, like real intake does.
    const GAPS = [2, 9, 3, 7, 4, 8, 1, 6];
    const daysAgo = Array.from({ length: 37 - i }, (_, k) => GAPS[(k + i) % GAPS.length]).reduce(
      (sum, g) => sum + g,
      0,
    );
    const createdMs = now - daysAgo * DAY + 3 * 3_600_000;
    const created = new Date(createdMs).toISOString();
    const step = (days: number) => new Date(createdMs + days * DAY).toISOString();
    const name = `${NAMES[i % NAMES.length]} ${pad(i, 2)}`;

    const app: Application = {
      id: `app-${pad(i, 3)}`,
      reference: `MA-2026-${pad(i, 4)}`,
      status,
      createdById: owner.id,
      assignedReviewerId: reviewer?.id ?? null,
      createdAt: created,
      updatedAt: created,
      data: {
        business: {
          legalName: `${name} Pvt. Ltd.`,
          tradingName: name,
          businessType: 'PRIVATE_LIMITED',
          registrationNumber: `TEST-${pad(1000 + i, 6)}`,
          incorporationDate: '2020-03-15',
          website: 'https://example.com',
          category: 'RETAIL',
        },
        contact: {
          contactName: 'Test Contact',
          email: `contact${i}@example.com`,
          phone: '+9779800000000',
          addressLine1: `${i} Example Street`,
          city: 'Kathmandu',
          country: 'NP',
          postalCode: '44600',
        },
        owners: [
          {
            fullName: 'Test Owner',
            dateOfBirth: '1985-06-01',
            ownershipPercent: 100,
            nationalId: `TESTID${pad(i, 6)}`,
          },
        ],
        banking: {
          bankName: 'Example Test Bank',
          accountHolder: `${name} Pvt. Ltd.`,
          accountNumber: `000000${pad(i, 6)}`,
          routingCode: 'TESTBANK01',
          expectedMonthlyVolume: 500_000 + i * 10_000,
          averageTicketSize: 1_500,
        },
      },
      history: [{ id: `h-${i}-1`, at: created, type: 'CREATED', actorName: owner.name }],
    };

    if (status !== 'DRAFT') {
      app.history.push({ id: `h-${i}-2`, at: step(1), type: 'SUBMITTED', actorName: owner.name });
    }
    if (reviewer) {
      app.history.push({
        id: `h-${i}-3`,
        at: step(2),
        type: 'ASSIGNED',
        actorName: 'Ada Admin',
        reviewerName: reviewer.name,
      });
    }
    if (status === 'INFO_REQUESTED' || status === 'APPROVED' || status === 'REJECTED') {
      const decision =
        status === 'APPROVED' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : 'REQUEST_INFO';
      app.history.push({
        id: `h-${i}-4`,
        at: step(3),
        type: 'DECISION',
        actorName: reviewer!.name,
        decision,
        riskLevel: status === 'REJECTED' ? 'HIGH' : status === 'APPROVED' ? 'LOW' : 'MEDIUM',
        notes: decision === 'APPROVE' ? undefined : 'Seeded decision note for demo purposes.',
      });
    }
    app.updatedAt = app.history[app.history.length - 1].at;
    apps.push(app);
  }
  return apps;
}
