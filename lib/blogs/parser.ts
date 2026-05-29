// lib/blogs/parser.ts
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import type { ParsedArticle, RawPost } from './types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});
// Remove boilerplate selectors entirely before conversion
turndown.remove(['script', 'style', 'noscript', 'iframe']);

const BODY_SELECTORS = [
  // Standard WordPress / generic blog markup
  'article .entry-content',
  '.entry-content',
  'article',
  // Elementor-built WordPress sites (e.g., projecttech4dev.org)
  '.elementor-widget-theme-post-content',
  // Last-resort fallback
  'main',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBody($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
  for (const sel of BODY_SELECTORS) {
    const $el = $(sel).first();
    if ($el.length && $el.text().trim().length > 200) return $el;
  }
  return null;
}

function clean(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $body: cheerio.Cheerio<any>,
  _$: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): cheerio.Cheerio<any> {
  // Drop known boilerplate inside the body
  $body
    .find(
      [
        'nav',
        'footer',
        '.share',
        '.related-posts',
        '.post-navigation',
        '.comment-form',
        '.author-box',
        'form',
        // Elementor related-posts / "You may also like" widgets
        '.elementor-widget-loop-grid',
        '.elementor-widget-post-navigation',
      ].join(', '),
    )
    .remove();
  return $body;
}

export function parseArticle(raw: RawPost): ParsedArticle {
  const $ = cheerio.load(raw.html);

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1.entry-title').first().text().trim() ||
    $('h1').first().text().trim() ||
    raw.url;

  const author =
    $('meta[name="author"]').attr('content')?.trim() ||
    $('.author-name, .author, [rel="author"]').first().text().trim() ||
    null;

  const rawDate =
    $('time[datetime]').first().attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="article:published_time"]').attr('content');
  const publishedAt = rawDate
    ? new Date(rawDate).toISOString().slice(0, 10)
    : null;

  const excerpt =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    null;

  const $body = pickBody($);
  const contentMd = $body
    ? turndown.turndown(clean($body, $).html() ?? '').trim()
    : '';

  return { url: raw.url, title, author, publishedAt, excerpt, contentMd };
}
