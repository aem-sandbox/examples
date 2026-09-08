import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const loader = read('blocks/widget/widget.js');
const leadHTML = read('widgets/lead-gen/lead-gen.html');
const leadJS = read('widgets/lead-gen/lead-gen.js');
const leadCSS = read('widgets/lead-gen/lead-gen.css');
const leadCopy = JSON.parse(read('widgets/lead-gen/lead-gen.json'));
const officeHTML = read('widgets/office-archetype/office-archetype.html');
const officeJS = read('widgets/office-archetype/office-archetype.js');
const officeCSS = read('widgets/office-archetype/office-archetype.css');
const bannerCSS = read('widgets/gear-banner/gear-banner.css');
const bannerJS = read('widgets/gear-banner/gear-banner.js');
const viewerCSS = read('widgets/viewer-3d/viewer-3d.css');
const viewerJS = read('widgets/viewer-3d/viewer-3d.js');

test('generic loader preserves author content and rejects failed HTML responses', () => {
  assert.match(loader, /if \(!resp\.ok\) throw new Error/);
  assert.match(loader, /widget\.innerHTML = originalHTML/);
  assert.match(loader, /if \(!source\) throw new Error/);
});

test('generic loader establishes configuration and unique IDs before decoration', () => {
  const configuration = loader.indexOf('sourceUrl.searchParams.forEach');
  const decoration = loader.indexOf('if (mod.default) await mod.default(widget)');
  assert.ok(configuration > -1 && configuration < decoration);
  assert.ok(loader.indexOf('widget.dataset.instanceId = instanceId') < decoration);
});

test('lead widget does not collide with the page footer lifecycle', () => {
  assert.doesNotMatch(leadHTML, /<\/?footer\b/i);
  assert.match(leadHTML, /<div class="lead-gen-footer">/);
});

test('lead demo is explicit and never logs or submits personal data', () => {
  assert.doesNotMatch(leadJS, /console\.info\('Lead gen submission'/);
  assert.doesNotMatch(leadJS, /firstName:|lastName:|email:|phone:|company:/);
  Object.values(leadCopy).forEach((copy) => {
    assert.match(copy.steps.contact.consent, /browser|navigateur|navegador/i);
    assert.ok(!Object.hasOwn(copy.nav, 'sending'));
  });
});

test('repeatable interactive widgets namespace static and generated IDs', () => {
  assert.match(leadJS, /function namespaceLeadIds\(widget\)/);
  assert.match(leadJS, /`\$\{instanceId\}-\$\{inputName\}-\$\{opt\.value\}`/);
  assert.match(officeJS, /questionTitle\.id = `\$\{widget\.dataset\.instanceId\}-q-title`/);
  assert.match(officeJS, /`\$\{widget\.dataset\.instanceId\}-q\$\{index\}-\$\{opt\.value\}`/);
});

test('viewer full bleed has one section owner and no viewport-width breakout', () => {
  assert.match(viewerCSS, /main > \.section\.viewer-3d-container > \.viewer-3d-wrapper/);
  assert.doesNotMatch(viewerCSS, /100vw|50vw/);
});

test('widgets honor project breakpoints and reduced-motion preference', () => {
  [leadCSS, officeCSS, bannerCSS, viewerCSS].forEach((css) => {
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
  assert.doesNotMatch(`${bannerCSS}\n${viewerCSS}`, /width >= (768|1024)px/);
  assert.match(bannerJS, /prefers-reduced-motion: reduce/);
  assert.match(viewerJS, /prefers-reduced-motion: reduce/);
  assert.match(officeJS, /prefers-reduced-motion: reduce/);
});

test('programmatically focused surfaces retain visible focus treatment', () => {
  assert.doesNotMatch(`${leadCSS}\n${officeCSS}\n${viewerCSS}`, /outline:\s*none/);
  assert.match(leadCSS, /lead-gen-panel:focus-visible/);
  assert.match(officeCSS, /office-archetype-panel:focus-visible/);
  assert.match(viewerCSS, /viewer-3d-model:focus-visible/);
});

test('office quiz uses focused transitions rather than a broad live region', () => {
  assert.doesNotMatch(officeHTML, /aria-live=/);
  assert.match(officeJS, /panel\.focus\(\)/);
});
