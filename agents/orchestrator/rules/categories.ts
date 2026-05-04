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
  | 'anstallning'
  | 'arbetsmiljo'
  | 'irrelevant_for_ab';

export type Tag = Category | 'okand';

export const UNKNOWN_TAG: Tag = 'okand';
export const IRRELEVANT_TAG: Category = 'irrelevant_for_ab';

export const CATEGORY_KEYWORDS: Record<Category, readonly string[]> = {
  moms: [
    'moms',
    'mervärdesskatt',
    'vat',
    'momsdeklaration',
    'skattesats',
    'mervärdesskattelag',
    'momslag',
  ],
  arbetsgivare: ['arbetsgivare', 'anställd', 'lön', 'arbetsgivardeklaration'],
  'ag-avgifter': ['arbetsgivaravgift', 'sociala avgifter', 'ag-avgift'],
  k10: ['k10', 'fåmansbolag', 'fåmansaktiebolag', 'utdelning ägare'],
  bolagsskatt: [
    'bolagsskatt',
    'skattesats',
    'inkomstskatt aktiebolag',
    'inkomstskattelag',
    'skatteförfarandelag',
    'skattebetalningslag',
  ],
  arsredovisning: [
    'årsredovisning',
    'k2',
    'k3',
    'bfn',
    'redovisning',
    'årsredovisningslag',
    'bokföringslag',
    'redovisningslag',
  ],
  revisionsplikt: ['revisor', 'revision', 'revisionsplikt'],
  gdpr: ['dataskydd', 'gdpr', 'personuppgift', 'imy', 'dataskyddslag', 'integritetsskydd'],
  punktskatt: ['punktskatt', 'energiskatt', 'alkoholskatt', 'tobaksskatt'],
  anstallning: [
    'sjuklön',
    'vab',
    'föräldrapenning',
    'lass',
    'afs',
    'lag om anställningsskydd',
    'arbetstidslag',
    'semesterlag',
  ],
  arbetsmiljo: ['arbetsmiljö', 'afs', 'skyddsombud', 'arbetsmiljölag'],
  irrelevant_for_ab: [
    'vapenförordning',
    'vapenlag',
    'trafikförordning',
    'körkortslag',
    'skogsvårdslag',
    'fiskelag',
    'djurskyddslag',
  ],
};

export const ACTION_KEYWORDS: readonly string[] = [
  'deklaration',
  'anmäl',
  'registrera',
  'betala',
];

export const ALL_CATEGORIES: readonly Category[] = Object.keys(CATEGORY_KEYWORDS) as Category[];
