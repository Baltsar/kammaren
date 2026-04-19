/**
 * Chat Handler — CEO-agent chat via Anthropic API
 *
 * ⚠️  WIP — EJ FÄRDIGT I PUBLIKA REPOT
 *
 * Denna modul är en del av det pågående agent-arbetet (CEO/Finance/Auditor/
 * Researcher) och kräver filer som ännu inte ligger i publika repot:
 *   - agents/ceo/SOUL.md
 *   - agents/ceo/SKILL.md
 *   - vault/company/profile.json
 *
 * Att köra `bun run bot:telegram` eller `bun run chat` innan dessa finns
 * kommer resultera i ENOENT vid första meddelandet. Modulen ligger kvar i
 * publika repot av transparensskäl — roadmap finns i STATUS.md.
 *
 * Säkerhet: `vault_read`-tooltillåter LLM:en att läsa filer under vault/.
 * Path-traversal-skyddet nedan är syntaktiskt; innehållsklassificering
 * (public/internal/sensitive) är ännu inte implementerad. Använd inte mot
 * vault med riktig PII innan den layern finns.
 *
 * Tar emot meddelanden, anropar Claude med CEO:ns SOUL+SKILL som system prompt,
 * och exponerar 4 tools: tax_optimize, vault_read, list_invoices, list_pending.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { calculate } from '../skills/tax-optimizer/optimize.js';

// ── Root path ───────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ── Interfaces ──────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  userId: string;
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  text: string;
  actions?: Array<{ label: string; action: string }>;
}

// ── Tool definitions for Anthropic API ──────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'tax_optimize',
    description:
      'Beräkna optimal fördelning mellan lön och utdelning för fåmansföretagare enligt 3:12-reglerna. ' +
      'Returnerar rekommenderad lön, utdelning, skatter och nettoresultat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        revenue: { type: 'number', description: 'Bolagets totala intäkter (SEK)' },
        costs: { type: 'number', description: 'Bolagets totala kostnader exkl lön (SEK)' },
        municipal_tax_rate: { type: 'number', description: 'Kommunalskattesats (t.ex. 0.3055)' },
        church_member: { type: 'boolean', description: 'Medlem i Svenska kyrkan' },
        saved_dividend_space: { type: 'number', description: 'Sparat utdelningsutrymme från tidigare år (SEK)' },
        num_owners: { type: 'number', description: 'Antal delägare' },
      },
      required: ['revenue', 'costs', 'municipal_tax_rate', 'church_member', 'saved_dividend_space', 'num_owners'],
    },
  },
  {
    name: 'vault_read',
    description:
      'Läs en fil från vault/. Returnerar filinnehållet som text. ' +
      'Använd för att läsa t.ex. profile.json, policies.json, fakturor, bokföringsposter.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Sökväg relativt vault/, t.ex. "company/profile.json"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_invoices',
    description: 'Lista alla fakturor i vault/invoices/. Returnerar fakturanummer, belopp och status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_pending',
    description: 'Lista alla väntande uppgifter i vault/tasks/pending/. Returnerar task-id, agent, typ och prioritet.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────

function toolTaxOptimize(input: Record<string, unknown>): string {
  const profile = JSON.parse(
    readFileSync(resolve(ROOT, 'vault/company/profile.json'), 'utf-8'),
  );

  const skillInput = {
    revenue: (input.revenue as number) ?? 0,
    costs: (input.costs as number) ?? 0,
    municipal_tax_rate: (input.municipal_tax_rate as number) ?? 0.3055,
    church_member: (input.church_member as boolean) ?? profile.church_member ?? false,
    saved_dividend_space: (input.saved_dividend_space as number) ?? profile.saved_dividend_space ?? 0,
    num_owners: (input.num_owners as number) ?? profile.num_owners ?? 1,
  };

  const result = calculate(skillInput);
  return JSON.stringify(result, null, 2);
}

function toolVaultRead(input: Record<string, unknown>): string {
  const rawPath = String(input.path ?? '');

  // Security: no path traversal
  if (rawPath.includes('..')) {
    return 'FEL: Sökvägen får inte innehålla ".."';
  }

  const normalized = normalize(rawPath);
  if (normalized.startsWith('/') || normalized.startsWith('..')) {
    return 'FEL: Ogiltig sökväg. Ange relativ sökväg under vault/.';
  }

  const fullPath = resolve(ROOT, 'vault', normalized);

  // Ensure path is still under vault/
  const vaultDir = resolve(ROOT, 'vault');
  if (!fullPath.startsWith(vaultDir)) {
    return 'FEL: Sökvägen måste ligga under vault/.';
  }

  if (!existsSync(fullPath)) {
    return `FEL: Filen finns inte: vault/${normalized}`;
  }

  return readFileSync(fullPath, 'utf-8');
}

function toolListInvoices(): string {
  const invoiceDir = resolve(ROOT, 'vault/invoices');
  if (!existsSync(invoiceDir)) return '[]';

  const files = readdirSync(invoiceDir).filter(f => f.endsWith('.json'));
  const invoices = files.map(f => {
    try {
      const data = JSON.parse(readFileSync(resolve(invoiceDir, f), 'utf-8'));
      return {
        invoice_number: data.invoice_number ?? f.replace('.json', ''),
        gross_amount: data.gross_amount ?? null,
        net_amount: data.net_amount ?? null,
        status: data.status ?? 'active',
        date: data.date ?? null,
        buyer: data.buyer?.name ?? data.buyer?.client_id ?? null,
      };
    } catch {
      return { invoice_number: f.replace('.json', ''), error: 'ogiltig JSON' };
    }
  });

  return JSON.stringify(invoices, null, 2);
}

function toolListPending(): string {
  const pendingDir = resolve(ROOT, 'vault/tasks/pending');
  if (!existsSync(pendingDir)) return '[]';

  const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
  const tasks = files.map(f => {
    try {
      const data = JSON.parse(readFileSync(resolve(pendingDir, f), 'utf-8'));
      return {
        id: data.id ?? f.replace('.json', ''),
        agent: data.agent ?? null,
        task_type: data.task_type ?? null,
        priority: data.priority ?? null,
        description: data.description ?? null,
        created_at: data.created_at ?? null,
      };
    } catch {
      return { id: f.replace('.json', ''), error: 'ogiltig JSON' };
    }
  });

  return JSON.stringify(tasks, null, 2);
}

function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'tax_optimize':
      return toolTaxOptimize(input);
    case 'vault_read':
      return toolVaultRead(input);
    case 'list_invoices':
      return toolListInvoices();
    case 'list_pending':
      return toolListPending();
    default:
      return `FEL: Okänt verktyg "${name}"`;
  }
}

// ── Build system prompt ─────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const soul = readFileSync(resolve(ROOT, 'agents/ceo/SOUL.md'), 'utf-8');
  const skill = readFileSync(resolve(ROOT, 'agents/ceo/SKILL.md'), 'utf-8');
  const profile = JSON.parse(
    readFileSync(resolve(ROOT, 'vault/company/profile.json'), 'utf-8'),
  );

  return [
    soul,
    '\n---\n',
    skill,
    '\n---\n',
    '## Bolagskontext\n',
    `Bolag: ${profile.name} (${profile.org_number})`,
    `Bransch: ${profile.industry}`,
    `Aktiekapital: ${profile.share_capital} SEK`,
    `Räkenskapsår: ${profile.fiscal_year.start}–${profile.fiscal_year.end}`,
    `Redovisningsstandard: ${profile.accounting_standard}`,
    `Bank: ${profile.bank.name} (BG ${profile.bank.bankgiro})`,
    profile.simulation ? '\nOBS: Simuleringsläge. Inga riktiga transaktioner.' : '',
    '\n---\n',
    'Du har tillgång till 4 verktyg: tax_optimize, vault_read, list_invoices, list_pending.',
    'Använd dem för att hämta data innan du svarar.',
    'Svara alltid på svenska.',
  ].join('\n');
}

// ── Main handler ────────────────────────────────────────────────────────

export async function handleMessage(req: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY saknas i miljövariabler');
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt();

  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: req.message },
  ];

  // Tool loop: keep calling until we get a final text response
  let finalText = '';
  const maxIterations = 10;

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
      tools: TOOLS,
    });

    // Check if response contains tool_use blocks
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use',
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    // Collect any text from this response
    for (const tb of textBlocks) {
      finalText += tb.text;
    }

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      break;
    }

    // Execute each tool and build tool_result messages
    const assistantContent = response.content;
    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(tu => ({
      type: 'tool_result' as const,
      tool_use_id: tu.id,
      content: executeTool(tu.name, tu.input as Record<string, unknown>),
    }));

    // Add assistant response and tool results to conversation
    messages = [
      ...messages,
      { role: 'assistant', content: assistantContent },
      { role: 'user', content: toolResults },
    ];

    // Reset text for next iteration (we want the final text)
    if (toolUseBlocks.length > 0) {
      finalText = '';
    }
  }

  const disclaimer = '\n\n⚠ Beslutsstöd. Verifiera med rådgivare.';

  return {
    text: (finalText || 'Kunde inte generera svar.') + disclaimer,
  };
}
