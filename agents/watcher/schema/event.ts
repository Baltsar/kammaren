export type WatcherEvent = {
  id: string;
  source: 'skv' | 'riksdagen';
  type: string;
  title: string;
  url: string;
  published_at: string;
  raw: Record<string, unknown>;
  fetched_at: string;
};
