import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), '..');

export async function readRepoMarkdown(filename: 'TERMS.md' | 'PRIVACY.md'): Promise<string> {
  // process.cwd() är dashboard/ i Vercel-builden; repo-roten är ovanför.
  // outputFileTracingIncludes i next.config.mjs säkerställer att filerna
  // följer med build-artefakten på serverless functions.
  return readFile(path.join(REPO_ROOT, filename), 'utf8');
}

/**
 * Mini Markdown → HTML-renderare. Bara det vi använder i TERMS/PRIVACY:
 *   # / ## / ### rubriker, **bold**, [text](url), listor (-/* och 1.),
 *   inline `code` och blank-rad-paragraph.
 *
 * Räcker för våra filer och slipper en MD-runtime-dependency för en
 * läs-only-vy. Output escapas innan formatering läggs på.
 */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  let inUl = false;
  let inOl = false;
  let inP = false;
  let inTable = false;

  const closeAll = (): void => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
    if (inP) {
      out.push('</p>');
      inP = false;
    }
    if (inTable) {
      out.push('</tbody></table>');
      inTable = false;
    }
  };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/g, '');

    if (line === '') {
      closeAll();
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch) {
      closeAll();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    if (ulMatch) {
      if (!inUl) {
        closeAll();
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      if (!inOl) {
        closeAll();
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    if (line.startsWith('| ')) {
      // Lättviktstöd för markdown-tabeller (bara för Watcher-leverantörs-
      // tabellen i PRIVACY.md). Skip rena | --- |-rader.
      if (/^\|[\s|:-]+\|$/.test(line)) continue;
      const cells = line
        .slice(1, line.endsWith('|') ? -1 : undefined)
        .split('|')
        .map((c) => c.trim());
      if (!inTable) {
        closeAll();
        out.push('<table><tbody>');
        inTable = true;
      }
      const tds = cells.map((c) => `<td>${formatInline(c)}</td>`).join('');
      out.push(`<tr>${tds}</tr>`);
      continue;
    }

    if (line === '---') {
      closeAll();
      out.push('<hr />');
      continue;
    }

    if (!inP) {
      closeAll();
      out.push('<p>');
      inP = true;
    } else {
      out.push(' ');
    }
    out.push(formatInline(line));
  }

  closeAll();
  return out.join('');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(input: string): string {
  let out = escapeHtml(input);
  // [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text: string, url: string) =>
      `<a href="${url}" target="_blank" rel="noopener">${text}</a>`,
  );
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // `code`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}
