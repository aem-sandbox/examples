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
    body: '<div data-view="logged-in" id="member"><div class="cards logged-out" id="wrong-promo"></div><div class="cards logged-in" id="member-card"></div><div class="cards logged-in logged-out" id="member-both"></div></div><div data-view="logged-out" id="anonymous"><div class="cards logged-in" id="wrong-member"></div><div class="cards logged-out" id="promo"></div><div class="cards logged-in logged-out" id="anonymous-both"></div></div>',
    anonymous: ['anonymous', 'promo', 'anonymous-both'],
    member: ['member', 'member-card', 'member-both'],
  },
  {
    name: 'exact block classes and inclusive audience variants',
    body: '<div><div class="cards logged-in" id="member"></div><div class="cards logged-out" id="anonymous"></div><div class="cards logged-out-promo" id="public"></div><div class="cards logged-in logged-out" id="both"></div><div class="cards logged-out logged-in" id="both-reversed"></div></div>',
    anonymous: ['anonymous', 'public', 'both', 'both-reversed'],
    member: ['member', 'public', 'both', 'both-reversed'],
  },
  {
    name: 'inclusive variants preserve parent and child block restrictions',
    body: '<div><div class="columns logged-in" id="member-parent"><div class="cards logged-in logged-out" id="member-child"></div></div><div class="columns logged-out" id="anonymous-parent"><div class="cards logged-in logged-out" id="anonymous-child"></div></div><div class="columns logged-in logged-out" id="both-parent"><div class="cards logged-in" id="member-grandchild"></div><div class="cards logged-out" id="anonymous-grandchild"></div><div class="cards logged-in logged-out" id="both-grandchild"></div></div></div>',
    anonymous: ['anonymous-parent', 'anonymous-child', 'both-parent', 'anonymous-grandchild', 'both-grandchild'],
    member: ['member-parent', 'member-child', 'both-parent', 'member-grandchild', 'both-grandchild'],
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
