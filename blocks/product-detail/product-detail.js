import { createTag } from '../../scripts/shared.js';

function factRow(label, value) {
  return createTag('div', { class: 'product-detail-fact' }, [
    createTag('dt', {}, label),
    createTag('dd', {}, value),
  ]);
}

/** Mustache can't format, so the star string is built here rather than upstream. */
function ratingStars(rating) {
  const score = Number.parseFloat(rating);
  if (Number.isNaN(score)) return null;
  const filled = Math.round(Math.min(Math.max(score, 0), 5));
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)} ${score}`;
}

/**
 * Decorates a JSON2HTML `product-detail` record into a product detail page. The block reads
 * positionally, matching the HTML semantics the template renders — heading row (name, category),
 * media row (image), stats row (price/currency, color, rating, stock quantity, in_stock),
 * identifiers row (sku, product_id) — rather than labeled key/value rows. A separate block from
 * the authored `product` block, so a generated catalog page can't clobber the DA one.
 * @param {Element} block the `.product-detail` block
 */
export default function decorate(block) {
  const [headingRow, mediaRow, statsRow, idsRow] = [...block.children];

  const name = headingRow?.children[0]?.textContent.trim();
  const category = headingRow?.children[1]?.textContent.trim();
  const img = mediaRow?.querySelector('img');
  const [priceCell, colorCell, ratingCell, stockQtyCell, inStockCell] = statsRow?.children || [];
  const [skuCell, productIdCell] = idsRow?.children || [];

  const price = priceCell?.textContent.trim();
  const color = colorCell?.textContent.trim();
  const rating = ratingCell?.textContent.trim();
  const stockQuantity = stockQtyCell?.textContent.trim();
  const inStock = inStockCell?.textContent.trim().toUpperCase() === 'TRUE';
  const sku = skuCell?.textContent.trim();
  const productId = productIdCell?.textContent.trim();

  block.textContent = '';

  const subtitle = [category, inStock ? null : 'Out of stock'].filter(Boolean).join(' · ');
  const heading = createTag('div', { class: 'product-detail-heading' }, [
    createTag('h1', {}, name || 'Product'),
    subtitle ? createTag('p', { class: 'product-detail-subtitle' }, subtitle) : '',
  ]);

  if (img) {
    img.setAttribute('loading', 'eager');
    const media = createTag('div', { class: 'product-detail-media' }, img);
    block.append(createTag('div', { class: 'product-detail-hero' }, [media, heading]));
  } else {
    block.append(createTag('div', { class: 'product-detail-hero product-detail-hero-noimage' }, heading));
  }

  const facts = createTag('dl', { class: 'product-detail-facts' });
  if (price) facts.append(factRow('Price', price));
  if (sku) facts.append(factRow('SKU', sku));
  if (color) facts.append(factRow('Color', color));
  if (stockQuantity) {
    facts.append(factRow('Availability', inStock ? `${stockQuantity} in stock` : 'Out of stock'));
  }
  const stars = ratingStars(rating);
  if (stars) facts.append(factRow('Rating', stars));
  if (productId) facts.append(factRow('Product ID', productId));
  if (facts.children.length) block.append(facts);
}
