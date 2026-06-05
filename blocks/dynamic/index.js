/** Conditionally loads dynamic blocks (tabs from section metadata). */
export default async function dynamicBlocks(main) {
  if (!main?.querySelector('.section[data-tab-id]')) return;

  const { createTabs } = await import('../tabs/tabs.js');
  await createTabs(main);
}
