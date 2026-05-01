import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { WatcherEvent } from '../schema/event.js';

type DiscoveredFeed = {
  title: string;
  url: string;
  fromIndex: string;
};

const INDEX_PAGES = [
  'https://www.skatteverket.se/omoss/digitalasamarbeten/prenumererapanyheterviarss.4.1657ce2817f5a993c3a5403.html',
  'https://www.skatteverket.se/funktioner/rss/prenumererapanyheterrattsinformation.4.dfe345a107ebcc9baf800017562.html',
];

const INDEX_TIMEOUT_MS = 15_000;
const HEAD_TIMEOUT_MS = 8_000;
const FEED_TIMEOUT_MS = 30_000;
const UA = 'Mozilla/5.0 (compatible; KammarenWatcher/0.1)';

export type SkvPollStats = {
  attempted: number;
  delivered: number;
  timeouts: number;
  empty: number;
  errors: number;
};

export type SkvPollResult = {
  events: WatcherEvent[];
  stats: SkvPollStats;
};

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

function hashId(url: string, publishedAt: string): string {
  return createHash('sha256').update(url + publishedAt).digest('hex').slice(0, 16);
}

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'User-Agent': UA,
        Accept: 'application/rss+xml,application/xml,text/xml,text/html,*/*',
        ...(init.headers ?? {}),
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function cleanTitle(s: string): string {
  return s
    .replace(/Länk till annan webbplats\.?/gi, '')
    .replace(/^Länkadress för RSS-flöde\s*/i, '')
    .trim();
}

async function fetchIndex(indexUrl: string): Promise<DiscoveredFeed[]> {
  try {
    const res = await fetchWithTimeout(indexUrl, INDEX_TIMEOUT_MS);
    if (!res.ok) {
      console.warn(`[watcher][skv] index ${indexUrl} -> ${res.status}`);
      return [];
    }
    const html = await res.text();
    const re = /<a\s+[^>]*href="([^"]*portlet[^"]*state=rss[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const found: DiscoveredFeed[] = [];
    for (const match of html.matchAll(re)) {
      const url = decodeEntities(match[1]);
      const title = cleanTitle(stripTags(match[2]));
      if (!url) continue;
      found.push({ title, url, fromIndex: indexUrl });
    }
    return found;
  } catch (err) {
    console.warn(`[watcher][skv] index ${indexUrl} fetch failed:`, err);
    return [];
  }
}

async function discoverFeeds(): Promise<DiscoveredFeed[]> {
  const all: DiscoveredFeed[] = [];
  for (const indexUrl of INDEX_PAGES) {
    const feeds = await fetchIndex(indexUrl);
    all.push(...feeds);
  }
  const seen = new Set<string>();
  return all.filter((f) => (seen.has(f.url) ? false : (seen.add(f.url), true)));
}

function isRelevant(feed: DiscoveredFeed): boolean {
  return feed.fromIndex.toLowerCase().includes('rattsinformation');
}

function classifyType(feed: DiscoveredFeed): 'rattsinfo' | 'nyhet' {
  return feed.fromIndex.toLowerCase().includes('rattsinformation') ? 'rattsinfo' : 'nyhet';
}

async function checkFeed(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, HEAD_TIMEOUT_MS, { method: 'HEAD' });
    if (!res.ok) {
      console.warn(`[watcher][skv] HEAD ${url} -> ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[watcher][skv] HEAD ${url} failed:`, err);
    return false;
  }
}

type FeedOutcome =
  | { kind: 'delivered'; events: WatcherEvent[] }
  | { kind: 'timeout' }
  | { kind: 'empty' }
  | { kind: 'error' };

async function fetchAndParseFeed(feed: DiscoveredFeed): Promise<FeedOutcome> {
  try {
    if (!(await checkFeed(feed.url))) return { kind: 'error' };

    let res: Response;
    try {
      res = await fetchWithTimeout(feed.url, FEED_TIMEOUT_MS);
    } catch (err) {
      if (isAbortError(err)) {
        console.warn(`[watcher][skv] feed timeout (${FEED_TIMEOUT_MS}ms) ${feed.url}`);
        return { kind: 'timeout' };
      }
      console.warn(`[watcher][skv] GET ${feed.url} failed:`, err);
      return { kind: 'error' };
    }

    if (!res.ok) {
      console.warn(`[watcher][skv] GET ${feed.url} -> ${res.status}`);
      return { kind: 'error' };
    }

    let xml: string;
    try {
      xml = await res.text();
    } catch (err) {
      if (isAbortError(err)) {
        console.warn(`[watcher][skv] body timeout (${FEED_TIMEOUT_MS}ms) ${feed.url}`);
        return { kind: 'timeout' };
      }
      console.warn(`[watcher][skv] body read failed ${feed.url}:`, err);
      return { kind: 'error' };
    }

    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
    const parsed = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
    const channel = parsed.rss?.channel;
    if (!channel) {
      console.warn(`[watcher][skv] no channel in ${feed.url}`);
      return { kind: 'empty' };
    }

    const rawItems = channel.item;
    if (!rawItems) return { kind: 'empty' };
    const items = (Array.isArray(rawItems) ? rawItems : [rawItems]) as Array<Record<string, unknown>>;

    const type = classifyType(feed);
    const fetchedAt = new Date().toISOString();
    const events: WatcherEvent[] = [];

    for (const raw of items) {
      try {
        const link = raw.link;
        const title = raw.title;
        const pubDate = raw.pubDate;
        if (typeof link !== 'string' || typeof title !== 'string' || typeof pubDate !== 'string') {
          continue;
        }
        const publishedAt = new Date(pubDate).toISOString();
        events.push({
          id: hashId(link, publishedAt),
          source: 'skv',
          type,
          title,
          url: link,
          published_at: publishedAt,
          raw,
          fetched_at: fetchedAt,
        });
      } catch (err) {
        console.warn('[watcher][skv] item parse failed:', err);
      }
    }
    return events.length > 0 ? { kind: 'delivered', events } : { kind: 'empty' };
  } catch (err) {
    if (isAbortError(err)) {
      console.warn(`[watcher][skv] feed timeout (${FEED_TIMEOUT_MS}ms) ${feed.url}`);
      return { kind: 'timeout' };
    }
    console.warn(`[watcher][skv] feed ${feed.url} failed:`, err);
    return { kind: 'error' };
  }
}

export async function pollSkv(): Promise<SkvPollResult> {
  const discovered = await discoverFeeds();
  console.log(`[watcher][skv] discovered ${discovered.length} feed(s) from ${INDEX_PAGES.length} index page(s)`);
  for (const feed of discovered) console.log(`  - "${feed.title}" -> ${feed.url}`);

  const relevant = discovered.filter(isRelevant);
  console.log(`[watcher][skv] ${relevant.length} feed(s) selected (from rättsinformation index)`);
  for (const feed of relevant) console.log(`  + "${feed.title}"`);

  const stats: SkvPollStats = {
    attempted: relevant.length,
    delivered: 0,
    timeouts: 0,
    empty: 0,
    errors: 0,
  };

  if (relevant.length === 0) {
    console.warn('[watcher][skv] no feeds selected; SKV polling skipped this run');
    return { events: [], stats };
  }

  const outcomes = await Promise.all(relevant.map((feed) => fetchAndParseFeed(feed)));
  const events: WatcherEvent[] = [];
  for (const outcome of outcomes) {
    switch (outcome.kind) {
      case 'delivered':
        stats.delivered++;
        events.push(...outcome.events);
        break;
      case 'timeout':
        stats.timeouts++;
        break;
      case 'empty':
        stats.empty++;
        break;
      case 'error':
        stats.errors++;
        break;
    }
  }
  return { events, stats };
}
