import {
  describe, expect, it,
} from 'vitest';
import { readFile } from 'node:fs/promises';

const workerConfig = new URL('../wrangler.toml', import.meta.url);
const deploymentWorkflow = new URL('../../../.github/workflows/deploy-worker.yaml', import.meta.url);

describe('managed Workers Cache configuration', () => {
  it('keeps the request gateway uncached and caches only the anonymous entrypoint', async () => {
    const config = await readFile(workerConfig, 'utf8');
    expect(config).toMatch(/\[cache]\s+enabled = true/);
    expect(config).toMatch(/\[exports\.default\.cache]\s+enabled = false/);
    expect(config).toMatch(/\[exports\.Anonymous\.cache]\s+enabled = true/);
    expect(config).not.toContain('cross_version_cache = true');
    expect(config).toMatch(/GATED_CACHE_PATHS = "\/gated-content"/);
  });

  it('deploys with a Wrangler release that supports per-entrypoint caching', async () => {
    const workflow = await readFile(deploymentWorkflow, 'utf8');
    const [, major, minor] = workflow.match(/wranglerVersion: "(\d+)\.(\d+)\.[0-9]+"/) || [];
    expect(Number(major)).toBe(4);
    expect(Number(minor)).toBeGreaterThanOrEqual(107);
  });
});
