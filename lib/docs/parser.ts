import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});
turndown.remove(['script', 'style', 'noscript', 'iframe']);

const BODY_SELECTORS = [
  '.theme-doc-markdown',
  'article .markdown',
  'main article',
  'main',
];

export interface ParsedDocPage {
  url: string;
  title: string;
  contentMd: string;
}

export function parseDocPage(html: string, url: string): ParsedDocPage {
  const $ = cheerio.load(html);

  const rawTitle =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    url;
  const title = rawTitle.replace(/\s*\|\s*Dalgo\s*$/i, '').trim();

  let $body: cheerio.Cheerio<unknown> | null = null;
  for (const sel of BODY_SELECTORS) {
    const $el = $(sel).first();
    if ($el.length && $el.text().trim().length > 50) {
      $body = $el as cheerio.Cheerio<unknown>;
      break;
    }
  }

  if ($body) {
    ($body as unknown as cheerio.Cheerio<cheerio.Element>)
      .find('nav, footer, .theme-doc-toc-desktop, .theme-doc-toc-mobile, .theme-doc-footer, .pagination-nav, .breadcrumbs, button, [aria-label="Copy code to clipboard"]')
      .remove();
  }

  const html2 =
    ($body as unknown as cheerio.Cheerio<cheerio.Element> | null)?.html() ?? '';
  const contentMd = turndown.turndown(html2).trim();

  return { url, title, contentMd };
}
