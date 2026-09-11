// @vitest-environment happy-dom
import {
  describe, it, beforeEach, expect,
} from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import decorate from '../blocks/product-detail/product-detail.js';

// The row shape templates/products/product-detail.html renders straight from the JSON record:
// heading row (name, category), media row (image), stats row (price+currency, color, rating,
// stock quantity, in_stock), identifiers row (sku, product_id) — read positionally, not by label.
const RECORD = `
<main><div>
  <div class="product-detail">
    <div>
      <div>
        <h1>Granite Loafers</h1>
      </div>
      <div>Footwear</div>
    </div>
    <div>
      <div>
        <img src="https://picsum.photos/seed/sku-foo-001/640/480" alt="Granite Loafers" loading="lazy">
      </div>
    </div>
    <div>
      <div>155.12 USD</div>
      <div>Green</div>
      <div>4.4</div>
      <div>224</div>
      <div>TRUE</div>
    </div>
    <div>
      <div>SKU-FOO-001</div>
      <div>PRD-0001</div>
    </div>
  </div>
</div></main>`;

const factPairs = (block) => [...block.querySelectorAll('.product-detail-facts .product-detail-fact')]
  .map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);

describe('product-detail block', () => {
  let block;

  beforeEach(() => {
    document.body.innerHTML = RECORD;
    block = document.querySelector('.product-detail');
    decorate(block);
  });

  it('renders the name as the heading and the category as the subtitle', () => {
    expect(block.querySelector('h1').textContent).toBe('Granite Loafers');
    expect(block.querySelector('.product-detail-subtitle').textContent).toBe('Footwear');
  });

  it('renders the hero image', () => {
    const img = block.querySelector('.product-detail-media img');
    expect(img.getAttribute('src')).toBe('https://picsum.photos/seed/sku-foo-001/640/480');
    expect(img.getAttribute('alt')).toBe('Granite Loafers');
  });

  it('renders price, sku, color, availability, rating and product id facts', () => {
    expect(factPairs(block)).toEqual([
      ['Price', '155.12 USD'],
      ['SKU', 'SKU-FOO-001'],
      ['Color', 'Green'],
      ['Availability', '224 in stock'],
      ['Rating', '★★★★☆ 4.4'],
      ['Product ID', 'PRD-0001'],
    ]);
  });
});

describe('product-detail block, out of stock', () => {
  it('flags out of stock in the subtitle and availability fact instead of the quantity', () => {
    document.body.innerHTML = RECORD.replace('<div>TRUE</div>', '<div>FALSE</div>');
    const block = document.querySelector('.product-detail');
    decorate(block);
    expect(block.querySelector('.product-detail-subtitle').textContent).toBe('Footwear · Out of stock');
    const availability = [...block.querySelectorAll('.product-detail-fact')]
      .find((row) => row.querySelector('dt').textContent === 'Availability');
    expect(availability.querySelector('dd').textContent).toBe('Out of stock');
  });
});
