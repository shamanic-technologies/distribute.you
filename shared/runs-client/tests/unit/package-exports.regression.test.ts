import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Regression: runs-client package.json pointed "main" at src/index.ts,
 * causing ERR_UNKNOWN_FILE_EXTENSION at runtime in Node.js.
 * Node cannot load .ts files natively — the entry must point to compiled JS.
 */
describe('runs-client package exports', () => {
  const pkgPath = path.join(__dirname, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  it('main should point to compiled JS, not TypeScript source', () => {
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.main).not.toMatch(/\.ts$/);
  });

  it('types should point to compiled declaration, not TypeScript source', () => {
    expect(pkg.types).toBe('dist/index.d.ts');
    expect(pkg.types).not.toMatch(/src\//);
  });

  it('dist/index.js should exist after build', () => {
    const distPath = path.join(__dirname, '../../dist/index.js');
    expect(fs.existsSync(distPath)).toBe(true);
  });

  it('dist/index.d.ts should exist after build', () => {
    const distPath = path.join(__dirname, '../../dist/index.d.ts');
    expect(fs.existsSync(distPath)).toBe(true);
  });
});

/**
 * Regression: RUNS_SERVICE_URL defaulted to localhost:3006, causing
 * ECONNREFUSED in production containers where no local runs-service exists.
 * Default must point to the production URL like other external services.
 */
describe('runs-client default URL', () => {
  it('compiled output should default to runs.distribute.you, not localhost', () => {
    const distPath = path.join(__dirname, '../../dist/index.js');
    const compiled = fs.readFileSync(distPath, 'utf-8');
    expect(compiled).toContain('https://runs.distribute.you');
    expect(compiled).not.toContain('localhost:3006');
  });
});
