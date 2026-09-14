export const audienceCases = [
  {
    name: 'section data attributes and public content',
    body: '<div data-view="logged-in" id="member"></div><div data-view="logged-out" id="anonymous"></div><div id="public"></div>',
    anonymous: ['anonymous', 'public'],
    member: ['member', 'public'],
  },
  {
    name: 'section metadata with normalized values',
    body: '<div id="member"><div class="section-metadata"><div><div>View</div><div> LOGGED-IN </div></div></div></div><div id="public"></div>',
    anonymous: ['public'],
    member: ['member', 'public'],
  },
  {
    name: 'block rules within retained audience sections',
    body: '<div data-view="logged-in" id="member"><div class="cards logged-out" id="wrong-promo"></div><div class="cards logged-in" id="member-card"></div></div><div data-view="logged-out" id="anonymous"><div class="cards logged-in" id="wrong-member"></div><div class="cards logged-out" id="promo"></div></div>',
    anonymous: ['anonymous', 'promo'],
    member: ['member', 'member-card'],
  },
  {
    name: 'exact block classes and opposing rules',
    body: '<div><div class="cards logged-in" id="member"></div><div class="cards logged-out" id="anonymous"></div><div class="cards logged-out-promo" id="public"></div><div class="cards logged-in logged-out" id="neither"></div></div>',
    anonymous: ['anonymous', 'public'],
    member: ['member', 'public'],
  },
  {
    name: 'removed parents cannot be overridden by children',
    body: '<div data-view="logged-in"><div class="cards logged-out" id="wrong-promo"></div></div><div data-view="logged-out"><div class="cards logged-in" id="wrong-member"></div></div>',
    anonymous: [],
    member: [],
  },
  {
    name: 'unrecognized section values do not restrict a section',
    body: '<div data-view="members" id="public"><div class="cards logged-in" id="member"></div></div>',
    anonymous: ['public'],
    member: ['public', 'member'],
  },
];

export function gatedPage(body, meta = '<meta name="gated" content="true">') {
  return `<!doctype html><html><head>${meta}</head><body><main>${body}</main></body></html>`;
}

export const gateMarkers = [
  '<meta name="gated" content="true">',
  '<meta content="true" name="gated">',
  '<meta name="gated" content=" TRUE ">',
  '<meta name=gated content=true>',
];
