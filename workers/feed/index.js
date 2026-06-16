const FEED_TITLE = 'Example Articles';
const FEED_DESCRIPTION = 'Latest reference article updates';
const FEED_LANGUAGE = 'en-ca';
const FEED_AUTHOR_NAME = 'Examples';
const PAGE_SIZE = 200;

/**
 * Fetch all rows from query-index, paginating as needed.
 * @param {string} origin - Content origin URL
 * @returns {Promise<Array>}
 */
async function fetchAllArticles(origin, siteUrl, env) {
  const results = [];
  let offset = 0;
  const host = new URL(siteUrl).hostname;

  let rows;
  do {
    const url = `${origin}/query-index.json?offset=${offset}&limit=${PAGE_SIZE}`;
    const headers = {
      'x-forwarded-host': host,
      'x-byo-cdn-type': 'cloudflare',
    };
    if (env.PUSH_INVALIDATION !== 'disabled') {
      headers['x-push-invalidation'] = 'enabled';
    }
    if (env.ORIGIN_AUTHENTICATION) {
      headers.authorization = `token ${env.ORIGIN_AUTHENTICATION}`;
    }
    const req = new Request(url, {
      headers,
      cf: { cacheEverything: true },
    });
    const resp = await fetch(req);
    if (!resp.ok) throw new Error(`query-index fetch failed: ${resp.status}`);
    const json = await resp.json();
    rows = json?.data || [];
    results.push(...rows);
    offset += rows.length;
  } while (rows.length === PAGE_SIZE);
  return results;
}

/**
 * Filter to article pages: paths under /learn/
 */
function isArticle(row) {
  const { path } = row;
  if (!path || !path.startsWith('/learn/')) return false;
  const segments = path.split('/').filter(Boolean);
  return segments.length >= 3;
}

/**
 * Get a sortable timestamp from a row.
 * Prefer authored `date` when available, fall back to `lastModified`.
 */
function getTimestamp(row) {
  const date = Number(row.date);
  const lastMod = Number(row.lastModified);
  const ts = date && !Number.isNaN(date) ? date : lastMod;
  return ts && !Number.isNaN(ts) ? ts * 1000 : 0;
}

/**
 * Build sorted article list.
 */
async function getArticles(origin, siteUrl, env) {
  const all = await fetchAllArticles(origin, siteUrl, env);
  return all
    .filter(isArticle)
    .sort((a, b) => getTimestamp(b) - getTimestamp(a));
}

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Resolve an image path to an absolute URL.
 */
function imageUrl(image, siteUrl) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return `${siteUrl}${image}`;
}

/**
 * Determine image MIME type from URL.
 * Prefers the `format` query param (AEM optimized delivery) over the file extension.
 */
function imageMimeType(url, siteUrl) {
  try {
    const format = new URL(url, siteUrl).searchParams.get('format');
    if (format) {
      if (format === 'pjpg' || format === 'jpeg' || format === 'jpg') return 'image/jpeg';
      if (format === 'png') return 'image/png';
      if (format === 'webp') return 'image/webp';
      if (format === 'gif') return 'image/gif';
    }
  } catch { /* fall through */ }
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Build RSS 2.0 XML.
 */
function buildRss(articles, siteUrl) {
  const now = new Date().toUTCString();
  const selfLink = `${siteUrl}/rss.xml`;

  const items = articles.map((row) => {
    const link = `${siteUrl}${row.path}`;
    const pubDate = new Date(getTimestamp(row)).toUTCString();
    const img = imageUrl(row.image, siteUrl);
    const enclosure = img
      ? `\n  <enclosure url="${escapeXml(img)}" length="0" type="${imageMimeType(img, siteUrl)}"/>`
      : '';

    return `<item>
  <title><![CDATA[${row.title || ''}]]></title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <pubDate>${pubDate}</pubDate>
  <description><![CDATA[${row.description || ''}]]></description>
${enclosure}
</item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <lastBuildDate>${now}</lastBuildDate>
    <language>${FEED_LANGUAGE}</language>
    <generator>Examples RSS Worker</generator>
    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml"/>
    ${items.join('\n    ')}
  </channel>
</rss>`;
}

/**
 * Build JSON Feed 1.1.
 * Spec: https://www.jsonfeed.org/version/1.1/
 */
function buildJsonFeed(articles, siteUrl) {
  const items = articles.map((row) => {
    const link = `${siteUrl}${row.path}`;
    const img = imageUrl(row.image, siteUrl);
    const item = {
      id: link,
      url: link,
      title: row.title || '',
      summary: row.description || '',
      date_published: new Date(getTimestamp(row)).toISOString(),
      authors: [{ name: FEED_AUTHOR_NAME }],
    };
    if (img) {
      item.image = img;
    }
    if (row.keywords && row.keywords.length) {
      const raw = Array.isArray(row.keywords) ? row.keywords.join(',') : String(row.keywords);
      const tags = raw.split(',').map((k) => k.trim()).filter(Boolean);
      if (tags.length) item.tags = tags;
    }
    return item;
  });

  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: FEED_TITLE,
    home_page_url: siteUrl,
    feed_url: `${siteUrl}/feed.json`,
    description: FEED_DESCRIPTION,
    language: FEED_LANGUAGE,
    authors: [{ name: FEED_AUTHOR_NAME }],
    items,
  }, null, 2);
}

/**
 * Worker entry point.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const siteUrl = (env.SITE_URL || 'https://examples.bbird.live').replace(/\/+$/, '');
    const origin = (env.CONTENT_ORIGIN || 'https://main--examples--aem-sandbox.aem.live').replace(/\/+$/, '');

    if (pathname !== '/rss.xml' && pathname !== '/feed.json') {
      return new Response('Not found', { status: 404 });
    }

    try {
      const articles = await getArticles(origin, siteUrl, env);

      if (pathname === '/feed.json') {
        return new Response(buildJsonFeed(articles, siteUrl), {
          headers: {
            'Content-Type': 'application/feed+json; charset=utf-8',
            'Cache-Control': 'max-age=7200, must-revalidate',
          },
        });
      }

      return new Response(buildRss(articles, siteUrl), {
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'max-age=7200, must-revalidate',
        },
      });
    } catch (err) {
      return new Response(`Feed generation failed: ${err.message}`, { status: 502 });
    }
  },
};
