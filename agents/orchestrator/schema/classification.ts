import { createHash } from 'node:crypto';

export type Severity = 'info' | 'warning' | 'action_required';

export type ClassificationMethod = 'deterministic' | 'llm' | 'llm-okand';

export type Classification = {
  id: string;
  event_id: string;
  customer_orgnr: string;
  relevant: boolean;
  severity: Severity;
  tags: string[];
  matched_rules: string[];
  summary: string;
  classified_at: string;
  method: ClassificationMethod;
};

export function makeClassificationId(eventId: string, customerOrgnr: string): string {
  return createHash('sha256').update(`${eventId}:${customerOrgnr}`).digest('hex').slice(0, 16);
}
