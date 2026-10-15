#!/usr/bin/env node
/**
 * Multi-schema Prisma runner.
 *
 * Every microservice owns its own database (database-per-service). Each one keeps a
 * schema at `apps/<service>/prisma/schema.prisma` that reads `env("DATABASE_URL")`.
 * This runner discovers those schemas and invokes the Prisma CLI once per service,
 * injecting that service's connection string from `<SERVICE>_DATABASE_URL`.
 *
 *   node tools/scripts/prisma.mjs generate
 *   node tools/scripts/prisma.mjs migrate dev --name init
 *   node tools/scripts/prisma.mjs db push
 *   node tools/scripts/prisma.mjs studio --service auth-service
 *   node tools/scripts/prisma.mjs seed --service catalog-service
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appsDir = join(root, 'apps');

/** Minimal .env parser so this works without extra dependencies. */
function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = { ...loadEnvFile(join(root, '.env.example')), ...loadEnvFile(join(root, '.env')) };
const env = { ...fileEnv, ...process.env };

const argv = process.argv.slice(2);
const serviceFlagIndex = argv.findIndex((a) => a === '--service' || a === '-s');
let onlyService = null;
if (serviceFlagIndex !== -1) {
  onlyService = argv[serviceFlagIndex + 1];
  argv.splice(serviceFlagIndex, 2);
}

if (argv.length === 0) {
  console.error('usage: prisma.mjs <prisma-command> [...args] [--service <name>]');
  process.exit(1);
}

if (!existsSync(appsDir)) {
  console.log('[prisma] no apps/ directory yet - nothing to do');
  process.exit(0);
}

const services = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => existsSync(join(appsDir, name, 'prisma', 'schema.prisma')))
  .filter((name) => !onlyService || name === onlyService)
  .sort();

if (services.length === 0) {
  console.log('[prisma] no schemas found - nothing to do');
  process.exit(0);
}

/** auth-service -> AUTH_SERVICE_DATABASE_URL */
const envKeyFor = (service) => `${service.replace(/-/g, '_').toUpperCase()}_DATABASE_URL`;

const isSeed = argv[0] === 'seed';
let failed = 0;

for (const service of services) {
  const schema = join(appsDir, service, 'prisma', 'schema.prisma');
  const key = envKeyFor(service);
  const url = env[key] ?? env.DATABASE_URL;

  if (!url) {
    console.warn(`[prisma] ${service}: ${key} is not set - skipping`);
    continue;
  }

  const childEnv = { ...env, DATABASE_URL: url };
  let cmd;
  let args;

  if (isSeed) {
    const seedFile = join(appsDir, service, 'prisma', 'seed.ts');
    if (!existsSync(seedFile)) continue;
    cmd = 'npx';
    // The compiler options travel as an env var, not a `--compiler-options '{"..."}'`
    // CLI arg: with `shell: true` below (needed for npx.cmd on Windows), cmd.exe's own
    // argument parsing strips the embedded double-quotes before ts-node ever sees them,
    // silently corrupting the JSON. TS_NODE_COMPILER_OPTIONS sidesteps shell quoting
    // entirely and works identically on every platform.
    childEnv.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });
    // Seed files import workspace libs through the `@ecommerce/*` aliases declared in
    // tsconfig.base.json; plain ts-node has no idea those exist, so it resolves them
    // as real npm packages and fails with MODULE_NOT_FOUND. tsconfig-paths/register
    // teaches it to read the same path map tsc and webpack already use.
    args = ['ts-node', '-r', 'tsconfig-paths/register', seedFile];
  } else {
    cmd = 'npx';
    args = ['prisma', ...argv, `--schema=${schema}`];
  }

  console.log(`\n[prisma] ${service}: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    failed++;
    console.error(`[prisma] ${service}: FAILED (exit ${result.status})`);
  }
}

process.exit(failed > 0 ? 1 : 0);
