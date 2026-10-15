import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  displayName: 'web',
  preset: '../../jest.preset.js',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/frontend/web',
  testEnvironment: 'jsdom',
};

const jestConfig = createJestConfig(config);

export default async () => {
  const resolved = await jestConfig();
  // Disable SWC path alias resolution — handled by Nx jest resolver.
  for (const value of Object.values(resolved.transform ?? {})) {
    if (!Array.isArray(value)) continue;
    const options = value[1] as { resolvedBaseUrl?: string } | undefined;
    if (options?.resolvedBaseUrl) {
      value[1] = { ...options, resolvedBaseUrl: undefined };
    }
  }
  return resolved;
};
