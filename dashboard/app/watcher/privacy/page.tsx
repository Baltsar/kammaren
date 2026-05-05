import type { Metadata } from 'next';
import { readRepoMarkdown, renderMarkdown } from '@/lib/markdown';

export const metadata: Metadata = {
  title: 'Integritetspolicy — KAMMAREN',
  description: 'KAMMAREN-tjänsten — integritetspolicy.',
};

export default async function PrivacyPage(): Promise<JSX.Element> {
  const source = await readRepoMarkdown('PRIVACY.md');
  const html = renderMarkdown(source);
  return (
    <article className="mx-auto max-w-prose px-6 py-12 prose prose-stone">
      <div
        className="space-y-4 text-sm leading-relaxed text-kammaren-body
        [&_h1]:text-3xl [&_h1]:mb-6 [&_h1]:mt-2
        [&_h2]:mt-8 [&_h2]:text-xl
        [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-mono [&_h3]:uppercase [&_h3]:tracking-[0.18em] [&_h3]:text-kammaren-label
        [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-kammaren-tamber
        [&_code]:font-mono [&_code]:text-xs [&_code]:bg-kammaren-cream-mid [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
        [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-kammaren-strong/10 [&_td]:p-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
