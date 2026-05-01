import { createHash } from 'node:crypto';
import type { WatcherEvent } from '../schema/event.js';

type Doktyp = {
  doktyp: string;
  type: 'sfs' | 'proposition';
};

const DOKTYPER: Doktyp[] = [
  { doktyp: 'sfs', type: 'sfs' },
  { doktyp: 'prop', type: 'proposition' },
];

function hashId(url: string, publishedAt: string): string {
  return createHash('sha256').update(url + publishedAt).digest('hex').slice(0, 16);
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

async function fetchDoktyp(doktyp: Doktyp, from: string): Promise<WatcherEvent[]> {
  try {
    const apiUrl = `https://data.riksdagen.se/dokumentlista/?doktyp=${encodeURIComponent(doktyp.doktyp)}&from=${encodeURIComponent(from)}&utformat=json`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.warn(`[watcher][riksdagen] GET ${apiUrl} -> ${res.status}`);
      return [];
    }

    const json = (await res.json()) as {
      dokumentlista?: { dokument?: Array<Record<string, unknown>> | Record<string, unknown> };
    };

    const rawDocs = json.dokumentlista?.dokument;
    if (!rawDocs) return [];
    const docs = Array.isArray(rawDocs) ? rawDocs : [rawDocs];

    const fetchedAt = new Date().toISOString();
    const events: WatcherEvent[] = [];

    for (const raw of docs) {
      try {
        const htmlUrl = typeof raw.dokument_url_html === 'string' ? raw.dokument_url_html : undefined;
        const textUrl = typeof raw.dokument_url_text === 'string' ? raw.dokument_url_text : undefined;
        const titel = typeof raw.titel === 'string' ? raw.titel : undefined;
        const publicerad = typeof raw.publicerad === 'string' ? raw.publicerad : undefined;

        const docUrl = htmlUrl ?? textUrl;
        if (!docUrl || !titel || !publicerad) {
          console.warn('[watcher][riksdagen] doc missing url/title/publicerad, skipping');
          continue;
        }

        const url = normalizeUrl(docUrl);
        const publishedAt = new Date(publicerad).toISOString();
        const id = hashId(url, publishedAt);

        events.push({
          id,
          source: 'riksdagen',
          type: doktyp.type,
          title: titel,
          url,
          published_at: publishedAt,
          raw,
          fetched_at: fetchedAt,
        });
      } catch (err) {
        console.warn('[watcher][riksdagen] doc parse failed:', err);
      }
    }

    return events;
  } catch (err) {
    console.warn(`[watcher][riksdagen] fetchDoktyp ${doktyp.doktyp} failed:`, err);
    return [];
  }
}

export async function pollRiksdagen(): Promise<WatcherEvent[]> {
  const from = thirtyDaysAgo();
  const results = await Promise.all(DOKTYPER.map((d) => fetchDoktyp(d, from)));
  return results.flat();
}
