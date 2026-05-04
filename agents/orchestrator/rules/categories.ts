export type Category =
  | 'moms'
  | 'arbetsgivare'
  | 'ag-avgifter'
  | 'k10'
  | 'bolagsskatt'
  | 'arsredovisning'
  | 'revisionsplikt'
  | 'gdpr'
  | 'punktskatt'
  | 'anstallning';

export type Tag = Category | 'okand';

export const UNKNOWN_TAG: Tag = 'okand';

export const CATEGORY_KEYWORDS: Record<Category, readonly string[]> = {
  moms: ['moms', 'mervärdesskatt', 'vat', 'momsdeklaration', 'skattesats'],
  arbetsgivare: ['arbetsgivare', 'anställd', 'lön', 'arbetsgivardeklaration'],
  'ag-avgifter': ['arbetsgivaravgift', 'sociala avgifter', 'ag-avgift'],
  k10: ['k10', 'fåmansbolag', 'fåmansaktiebolag', 'utdelning ägare'],
  bolagsskatt: ['bolagsskatt', 'skattesats', 'inkomstskatt aktiebolag'],
  arsredovisning: ['årsredovisning', 'k2', 'k3', 'bfn', 'redovisning'],
  revisionsplikt: ['revisor', 'revision', 'revisionsplikt'],
  gdpr: ['dataskydd', 'gdpr', 'personuppgift', 'imy'],
  punktskatt: ['punktskatt', 'energiskatt', 'alkoholskatt', 'tobaksskatt'],
  anstallning: ['sjuklön', 'vab', 'föräldrapenning', 'lass', 'afs'],
};

export const ACTION_KEYWORDS: readonly string[] = [
  'deklaration',
  'anmäl',
  'registrera',
  'betala',
];

export const ALL_CATEGORIES: readonly Category[] = Object.keys(CATEGORY_KEYWORDS) as Category[];
