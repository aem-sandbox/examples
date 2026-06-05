/** Conditionally loads dynamic blocks (modal, tabs from section metadata). */
export default async function dynamicBlocks(main) {
  const { setupFragmentModal } = await import('../modal/modal.js');
  setupFragmentModal(main);

  if (!main?.querySelector('.section[data-tab-id]')) return;

  const { createTabs } = await import('../tabs/tabs.js');
  await createTabs(main);
}
