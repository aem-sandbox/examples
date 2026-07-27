// @vitest-environment happy-dom
import {
  describe, it, beforeEach, expect,
} from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import decorate from '../blocks/product/product.js';

// Trimmed from a live record page, /products/apex-road-racer.plain.html. The ids are what the
// pipeline generates: the property key lowercased, de-duplicated across the whole document.
const RECORD = `
<main><div>
  <div class="da-form">
    <div><div><h3 id="x-schema-name">x-schema-name</h3></div><div>product</div></div>
    <div><div><h3 id="title">title</h3></div><div>Apex Road Racer</div></div>
  </div>
  <div class="product">
    <div><div><h3 id="name">name</h3></div><div>Apex Road Racer</div></div>
    <div><div><h3 id="slug">slug</h3></div><div>apex-road-racer</div></div>
    <div><div><h3 id="category">category</h3></div><div>Road</div></div>
    <div><div><h3 id="price">price</h3></div><div>3299</div></div>
    <div><div><h3 id="weightkg">weightKg</h3></div><div>7.8</div></div>
    <div><div><h3 id="instock">inStock</h3></div><div>false</div></div>
    <div><div><h3 id="framesizes">frameSizes</h3></div><div><ul><li>49</li><li>52</li></ul></div></div>
    <div><div><h3 id="specs">specs</h3></div><div><ul><li>self://#specs-aaa111</li><li>self://#specs-bbb222</li></ul></div></div>
  </div>
  <div class="specs specs-aaa111">
    <div><div><h3 id="label">label</h3></div><div>Frame</div></div>
    <div><div><h3 id="value">value</h3></div><div>T900 carbon fiber</div></div>
  </div>
  <div class="specs specs-bbb222">
    <div><div><h3 id="label-1">label</h3></div><div>Groupset</div></div>
    <div><div><h3 id="value-1">value</h3></div><div>Shimano 105 Di2</div></div>
  </div>
</div></main>`;

const factPairs = (block) => [...block.querySelectorAll('.product-facts .product-fact')]
  .map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);

const specPairs = (block) => [...block.querySelectorAll('.product-specs .product-fact')]
  .map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);

describe('product detail block', () => {
  let block;

  beforeEach(() => {
    document.body.innerHTML = RECORD;
    // What the pipeline derives from the first heading, the .da-form schema-name row.
    document.title = 'x-schema-name';
    block = document.querySelector('.product');
    decorate(block);
  });

  it('renders fields whose key is camelCase', () => {
    // The heading id is `weightkg`, the label text is `weightKg`.
    // Keying off the id loses the field.
    expect(factPairs(block)).toContainEqual(['Weight', '7.8 kg']);
    expect(factPairs(block)).toContainEqual(['Frame sizes', '49, 52']);
  });

  it('reads a camelCase boolean into the subtitle', () => {
    expect(block.querySelector('.product-subtitle').textContent).toContain('Out of stock');
  });

  it('renders every spec row, not only the first', () => {
    // The second `.specs` block carries `label-1` and `value-1` after document-wide id de-dup.
    expect(specPairs(block)).toEqual([
      ['Frame', 'T900 carbon fiber'],
      ['Groupset', 'Shimano 105 Di2'],
    ]);
  });

  it('keeps the fields whose key is already lowercase', () => {
    expect(block.querySelector('h1').textContent).toBe('Apex Road Racer');
    expect(factPairs(block)).toContainEqual(['Price', '$3299 USD']);
  });

  it('replaces the derived schema-name title with the product name', () => {
    expect(document.title).toBe('Apex Road Racer');
  });
});

describe('product detail block, authored title', () => {
  it('leaves a title that did not come from the schema-name row', () => {
    document.body.innerHTML = RECORD;
    document.title = 'Apex Road Racer | Bikes';
    decorate(document.querySelector('.product'));
    expect(document.title).toBe('Apex Road Racer | Bikes');
  });
});
