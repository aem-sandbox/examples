/** Conditionally loads and runs dynamic blocks (e.g. tabs, modal). */
export default async function dynamicBlocks(main) {
  // eslint-disable-next-line import/no-cycle
  const { setupFragmentModal } = await import('../modal/modal.js');
  setupFragmentModal(main);

  const hasTabSections = main?.querySelectorAll('.section[data-tab-id]').length > 0;
  if (!hasTabSections) return;

  const { createTabs } = await import('../tabs/tabs.js');
  await createTabs(main);
}
