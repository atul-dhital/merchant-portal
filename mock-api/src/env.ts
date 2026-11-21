import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Optional local overrides (see mock-api/.env.example). Never committed.
const envFile = resolve(process.cwd(), 'mock-api/.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const PORT = Number(process.env['MOCK_PORT'] ?? 3000);
export const LATENCY_MS = Number(process.env['MOCK_LATENCY_MS'] ?? 300);
export const FAIL_RATE = Number(process.env['MOCK_FAIL_RATE'] ?? 0);
