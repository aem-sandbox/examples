// Plain config object rather than vitest's defineConfig: vitest is a dependency of this test
// package only, so the root eslint run cannot resolve 'vitest/config'.
export default {
  test: {
    setupFiles: ['./setup.js'],
  },
};
