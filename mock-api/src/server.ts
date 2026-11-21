import { FAIL_RATE, LATENCY_MS, PORT } from './env';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  consumeRefreshToken,
  expireAllAccessTokens,
  issueTokens,
  requireAuth,
  revokeRefreshToken,
  setRefreshCookie,
} from './auth';
import { policy } from './policy';
import { attachRealtime, publishUpdate } from './realtime';
import { USERS, buildSeed } from './seed';
import type {
  Application,
  ApplicationData,
  Decision,
  HistoryEvent,
  RiskLevel,
  User,
} from './types';

const app = express();
const applications: Application[] = buildSeed();

app.disable('x-powered-by');

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Security headers + no caching for every API response (payloads may hold PII).
app.use((_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});

// Simulated network latency.
app.use((_req, _res, next) => {
  setTimeout(next, LATENCY_MS);
});

// ---------- helpers ----------

const userOf = (res: Response): User => res.locals['user'] as User;
const nameOf = (id: string | null) => USERS.find((u) => u.id === id)?.name ?? null;
const now = () => new Date().toISOString();

function mask(value: string | undefined): string {
  if (!value) return '';
  return `•••• ${value.slice(-4)}`;
}

function addEvent(target: Application, event: Omit<HistoryEvent, 'id' | 'at'>): void {
  target.history.push({ id: randomUUID(), at: now(), ...event });
}

function summary(a: Application) {
  return {
    id: a.id,
    reference: a.reference,
    status: a.status,
    legalName: a.data?.business?.legalName ?? '',
    tradingName: a.data?.business?.tradingName ?? '',
    country: a.data?.contact?.country ?? '',
    createdById: a.createdById,
    createdByName: nameOf(a.createdById),
    assignedReviewerId: a.assignedReviewerId,
    assignedReviewerName: nameOf(a.assignedReviewerId),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/** Sensitive values never leave the server unmasked except via the reveal endpoint. */
function maskedData(data: ApplicationData): ApplicationData {
  return {
    ...data,
    owners: data.owners.map((o) => ({ ...o, nationalId: mask(o.nationalId) })),
    banking: { ...data.banking, accountNumber: mask(data.banking.accountNumber) },
  };
}

/** Finds an application the current user may see. 404 (not 403) avoids leaking existence. */
function findVisible(req: Request, res: Response): Application | null {
  const found = applications.find((a) => a.id === req.params['id']);
  if (!found || !policy.canView(userOf(res), found)) {
    res.status(404).json({ message: 'Application not found.' });
    return null;
  }
  return found;
}

function forbid(res: Response, message = 'You are not allowed to perform this action.'): void {
  res.status(403).json({ message });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Drafts may be incomplete, but they must have the expected shape. */
function isApplicationData(d: unknown): d is ApplicationData {
  return (
    isObject(d) &&
    isObject(d['business']) &&
    isObject(d['contact']) &&
    isObject(d['banking']) &&
    Array.isArray(d['owners']) &&
    d['owners'].length <= 10 &&
    d['owners'].every(isObject)
  );
}

function rejectInvalidShape(res: Response): void {
  res.status(422).json({ message: 'Application data is malformed.' });
}

/** Minimal server-side validation on submit. The server never trusts the client. */
function submitErrors(d: ApplicationData): string[] {
  const errors: string[] = [];
  if (!d?.business?.legalName) errors.push('Legal name is required.');
  if (!d?.business?.registrationNumber) errors.push('Registration number is required.');
  if (!d?.contact?.email) errors.push('Contact email is required.');
  if (!Array.isArray(d?.owners) || d.owners.length === 0)
    errors.push('At least one owner is required.');
  const total = (d?.owners ?? []).reduce((s, o) => s + (Number(o.ownershipPercent) || 0), 0);
  if (total > 100) errors.push('Total ownership cannot exceed 100%.');
  if (!d?.banking?.accountNumber) errors.push('Bank account number is required.');
  const volume = Number(d?.banking?.expectedMonthlyVolume);
  const ticket = Number(d?.banking?.averageTicketSize);
  if (!(volume > 0) || !(ticket > 0) || ticket > volume) {
    errors.push('Average ticket size must be positive and not exceed monthly volume.');
  }
  return errors;
}

// ---------- auth ----------

app.get('/api/auth/demo-users', (_req, res) => {
  res.json(USERS);
});

app.post('/api/auth/login', (req, res) => {
  // Demo login: pick a seeded user. A real system would delegate to an identity provider.
  const user = USERS.find((u) => u.id === req.body?.userId);
  if (!user) {
    res.status(401).json({ message: 'Unknown demo user.' });
    return;
  }
  const { accessToken, refreshToken } = issueTokens(user.id);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user });
});

app.post('/api/auth/refresh', (req, res) => {
  const user = consumeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  if (!user) {
    clearRefreshCookie(res);
    res.status(401).json({ message: 'Refresh token invalid or expired.' });
    return;
  }
  const { accessToken, refreshToken } = issueTokens(user.id);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user });
});

app.post('/api/auth/logout', (req, res) => {
  revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).end();
});

if (process.env['NODE_ENV'] !== 'production') {
  app.post('/api/dev/expire-tokens', (_req, res) => {
    expireAllAccessTokens();
    res.status(204).end();
  });
}

// Everything below requires a valid access token.
app.use('/api', requireAuth);

// Optional failure injection to exercise loading/error/retry and auto-save error paths.
app.use('/api', (_req, res, next) => {
  if (FAIL_RATE > 0 && Math.random() < FAIL_RATE) {
    res.status(503).json({ message: 'Simulated service failure.' });
    return;
  }
  next();
});

// ---------- users ----------

app.get('/api/users', (req, res) => {
  if (userOf(res).role !== 'ADMIN') return forbid(res);
  const role = req.query['role'];
  res.json(USERS.filter((u) => !role || u.role === role));
});

// ---------- applications ----------

/** Case-insensitive match on reference, legal name or trading name (q already lower-cased). */
function matchesSearch(a: Application, q: string): boolean {
  return (
    !q ||
    a.reference.toLowerCase().includes(q) ||
    (a.data?.business?.legalName ?? '').toLowerCase().includes(q) ||
    (a.data?.business?.tradingName ?? '').toLowerCase().includes(q)
  );
}

app.get('/api/applications', (req, res) => {
  const user = userOf(res);
  const page = Math.max(1, Number(req.query['page']) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query['pageSize']) || 10));
  const status = String(req.query['status'] ?? '');
  const q = String(req.query['q'] ?? '')
    .trim()
    .toLowerCase();

  const visible = applications
    .filter((a) => policy.canView(user, a))
    .filter((a) => !status || a.status === status)
    .filter((a) => matchesSearch(a, q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const start = (page - 1) * pageSize;
  res.json({
    items: visible.slice(start, start + pageSize).map(summary),
    total: visible.length,
    page,
    pageSize,
  });
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Data for the overview page, scoped to what the user may see:
 * status counts, new applications per month (last 6), a role-specific
 * "needs attention" list and the latest activity.
 */
app.get('/api/overview', (_req, res) => {
  const user = userOf(res);
  const visible = applications.filter((a) => policy.canView(user, a));

  const byStatus: Record<string, number> = {};
  for (const a of visible) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;

  const now = new Date();
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    const key = d.toISOString().slice(0, 7);
    return {
      month: key,
      label: MONTHS[d.getUTCMonth()],
      created: visible.filter((a) => a.createdAt.startsWith(key)).length,
    };
  });

  const attentionStatuses: Record<User['role'], string[]> = {
    SALES: ['INFO_REQUESTED', 'DRAFT'],
    REVIEWER: ['IN_REVIEW'],
    ADMIN: ['SUBMITTED'],
  };
  const wanted = attentionStatuses[user.role];
  const attention = visible
    .filter((a) => wanted.includes(a.status))
    .sort(
      (a, b) =>
        wanted.indexOf(a.status) - wanted.indexOf(b.status) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  const activity = visible
    .flatMap((a) =>
      a.history.map((e) => ({
        ...e,
        applicationId: a.id,
        reference: a.reference,
        merchant: a.data?.business?.tradingName || a.data?.business?.legalName || a.reference,
      })),
    )
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 8);

  res.json({
    counts: { total: visible.length, byStatus },
    monthly,
    attention: { total: attention.length, items: attention.slice(0, 5).map(summary) },
    activity,
  });
});

/** Counts per status for the user's visible applications (respects the search term). */
app.get('/api/applications/counts', (req, res) => {
  const user = userOf(res);
  const q = String(req.query['q'] ?? '')
    .trim()
    .toLowerCase();
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const a of applications) {
    if (!policy.canView(user, a) || !matchesSearch(a, q)) continue;
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    total++;
  }
  res.json({ total, byStatus });
});

app.post('/api/applications', (req, res) => {
  const user = userOf(res);
  if (!policy.canCreate(user)) return forbid(res);
  if (!isApplicationData(req.body?.data)) return rejectInvalidShape(res);
  const n = applications.length + 1;
  const created: Application = {
    id: `app-${randomUUID().slice(0, 8)}`,
    reference: `MA-2026-${String(n).padStart(4, '0')}`,
    status: 'DRAFT',
    createdById: user.id,
    assignedReviewerId: null,
    createdAt: now(),
    updatedAt: now(),
    data: req.body?.data,
    history: [],
  };
  addEvent(created, { type: 'CREATED', actorName: user.name });
  applications.push(created);
  publishUpdate(created, summary(created), 'CREATED', user);
  res
    .status(201)
    .json({ id: created.id, reference: created.reference, updatedAt: created.updatedAt });
});

app.get('/api/applications/:id', (req, res) => {
  const found = findVisible(req, res);
  if (!found) return;
  res.json({ ...summary(found), data: maskedData(found.data), history: found.history });
});

/** Full (unmasked) draft for its author while it is editable. */
app.get('/api/applications/:id/draft', (req, res) => {
  const found = findVisible(req, res);
  if (!found) return;
  if (!policy.canEdit(userOf(res), found)) return forbid(res, 'This application cannot be edited.');
  res.json({ id: found.id, reference: found.reference, status: found.status, data: found.data });
});

app.put('/api/applications/:id/draft', (req, res) => {
  const found = findVisible(req, res);
  if (!found) return;
  if (!policy.canEdit(userOf(res), found)) return forbid(res, 'This application cannot be edited.');
  if (!isApplicationData(req.body?.data)) return rejectInvalidShape(res);
  found.data = req.body.data;
  found.updatedAt = now();
  res.json({ id: found.id, reference: found.reference, updatedAt: found.updatedAt });
});

app.post('/api/applications/:id/submit', (req, res) => {
  const user = userOf(res);
  const found = findVisible(req, res);
  if (!found) return;
  if (!policy.canEdit(user, found)) return forbid(res, 'This application cannot be submitted.');
  if (!isApplicationData(req.body?.data)) return rejectInvalidShape(res);
  const errors = submitErrors(req.body?.data);
  const registration = String(req.body?.data?.business?.registrationNumber ?? '').toUpperCase();
  const duplicate = applications.some(
    (a) =>
      a.id !== found.id && a.data?.business?.registrationNumber?.toUpperCase() === registration,
  );
  if (duplicate) errors.push('Registration number is already used by another application.');
  if (errors.length) {
    res.status(422).json({ message: errors.join(' ') });
    return;
  }
  found.data = req.body.data;
  found.status = found.assignedReviewerId ? 'IN_REVIEW' : 'SUBMITTED';
  found.updatedAt = now();
  addEvent(found, { type: 'SUBMITTED', actorName: user.name });
  publishUpdate(found, summary(found), 'SUBMITTED', user);
  res.json(summary(found));
});

app.put('/api/applications/:id/assignment', (req, res) => {
  const user = userOf(res);
  const found = findVisible(req, res);
  if (!found) return;
  if (!policy.canAssign(user, found)) return forbid(res);
  const reviewer = USERS.find((u) => u.id === req.body?.reviewerId && u.role === 'REVIEWER');
  if (!reviewer) {
    res.status(422).json({ message: 'Reviewer not found.' });
    return;
  }
  found.assignedReviewerId = reviewer.id;
  found.status = 'IN_REVIEW';
  found.updatedAt = now();
  addEvent(found, { type: 'ASSIGNED', actorName: user.name, reviewerName: reviewer.name });
  publishUpdate(found, summary(found), 'ASSIGNED', user);
  res.json(summary(found));
});

const DECISION_STATUS = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  REQUEST_INFO: 'INFO_REQUESTED',
} as const;
const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

app.post('/api/applications/:id/decision', (req, res) => {
  const user = userOf(res);
  const found = findVisible(req, res);
  if (!found) return;
  if (!policy.canDecide(user, found)) return forbid(res);

  const decision = req.body?.decision as Decision;
  const riskLevel = req.body?.riskLevel as RiskLevel;
  const notes = String(req.body?.notes ?? '').trim();
  if (!(decision in DECISION_STATUS) || !RISK_LEVELS.includes(riskLevel)) {
    res.status(422).json({ message: 'Invalid decision or risk level.' });
    return;
  }
  if (decision !== 'APPROVE' && notes.length < 10) {
    res.status(422).json({ message: 'Notes (min. 10 characters) are required for this decision.' });
    return;
  }
  found.status = DECISION_STATUS[decision];
  found.updatedAt = now();
  addEvent(found, {
    type: 'DECISION',
    actorName: user.name,
    decision,
    riskLevel,
    notes: notes || undefined,
  });
  publishUpdate(found, summary(found), 'DECISION', user);
  res.json(summary(found));
});

/** Controlled reveal of a single sensitive field. Permission-checked and audited. */
app.post('/api/applications/:id/reveal', (req, res) => {
  const user = userOf(res);
  const found = findVisible(req, res);
  if (!found) return;
  if (!policy.canRevealSensitive(user, found)) return forbid(res);

  const field = String(req.body?.field ?? '');
  let value: string | undefined;
  const ownerMatch = /^owners\.(\d+)\.nationalId$/.exec(field);
  if (field === 'banking.accountNumber') value = found.data.banking.accountNumber;
  else if (ownerMatch) value = found.data.owners[Number(ownerMatch[1])]?.nationalId;

  if (value === undefined) {
    res.status(422).json({ message: 'Unknown sensitive field.' });
    return;
  }
  addEvent(found, { type: 'SENSITIVE_REVEALED', actorName: user.name, field });
  res.json({ field, value });
});

// ---------- validation ----------

app.get('/api/validation/registration-number', (req, res) => {
  const value = String(req.query['value'] ?? '')
    .trim()
    .toUpperCase();
  const excludeId = String(req.query['excludeId'] ?? '');
  const taken = applications.some(
    (a) => a.id !== excludeId && a.data?.business?.registrationNumber?.toUpperCase() === value,
  );
  res.json({ available: !taken });
});

// Unknown API routes and unexpected errors: JSON only, never HTML or stack traces.
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found.' });
});
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status;
  if (status === 400 || status === 413) {
    res.status(status).json({ message: 'Invalid request body.' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error.' });
});

// HTTP API and Socket.IO (real-time status updates) share one port.
const httpServer = createServer(app);
attachRealtime(httpServer);
httpServer.listen(PORT, () => {
  console.log(
    `Mock API + Socket.IO on http://localhost:${PORT} (latency ${LATENCY_MS}ms, fail rate ${FAIL_RATE})`,
  );
});
