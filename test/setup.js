/**
 * Test harness setup.
 *
 * `sampleRUM` in scripts/aem.js selects roughly one run in a hundred
 * (`Math.random() * weight < 1`) and sends a real beacon to ot.aem.live. In CI that request is
 * aborted when the environment tears down, which vitest reports as an unhandled rejection and
 * fails the run even though every test passed. Opting out of sampling keeps the suite offline
 * and deterministic; `off` maps to weight 0, so no beacon is ever selected.
 */
if (typeof window !== 'undefined') {
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
}
