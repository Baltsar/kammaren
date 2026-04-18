/**
 * Skills — Shared interfaces
 *
 * Every skill MUST implement these interfaces exactly.
 * See CLAUDE-CODE-GUARDRAILS.md regel 5.
 */

export interface SkillInput {
  // Arrays/objekt tillåts för strukturerad input (t.ex. bolagsskatt.befintliga_fonder).
  // Skills ska validera vid parsning och kasta Error vid fel typ.
  [key: string]: number | string | boolean | unknown[] | Record<string, unknown>;
}

export interface SkillOutput {
  result: Record<string, number | string>;
  breakdown: Record<string, number | string>[];
  warnings: string[];
  sources: { name: string; url: string; date: string }[];
  disclaimer: string;
  version: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  tier: 'free' | 'premium' | 'enterprise';
  version: string;
  triggers: string[];
  inputSchema: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>;
  calculate(input: SkillInput): SkillOutput;
}
