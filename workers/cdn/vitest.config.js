import { fileURLToPath } from 'node:url';

export default {
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers.js', import.meta.url)),
    },
  },
};
