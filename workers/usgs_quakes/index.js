// Red-phase stub. Real handlers land in the green commit.

export default {
  async fetch() {
    throw new Error('not implemented');
  },
  async scheduled() {
    throw new Error('not implemented');
  },
};
