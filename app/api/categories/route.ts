import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

const CATEGORY_LABELS: Record<string, string> = {
  case_studies: 'Customer stories',
  pricing: 'Pricing & licensing',
  data_sources: 'Data sources',
  transforms: 'Transformations',
  dashboards: 'Dashboards & charts',
  orchestration: 'Pipelines & scheduling',
  sharing: 'Sharing & exports',
  rbac: 'Users & permissions',
  ai: 'AI features',
  security: 'Security',
  deployment: 'Deployment & hosting',
  mission: 'About Dalgo',
  stack: 'Tech stack',
  limitations: 'What Dalgo does NOT do',
};

const CATEGORY_ORDER = [
  'case_studies',
  'pricing',
  'data_sources',
  'transforms',
  'dashboards',
  'orchestration',
  'sharing',
  'rbac',
  'ai',
  'security',
  'deployment',
  'mission',
  'stack',
  'limitations',
];

const CATEGORY_ICONS: Record<string, string> = {
  case_studies: '🌟',
  data_sources: '🔌',
  transforms: '🧪',
  dashboards: '📊',
  orchestration: '⏱️',
  sharing: '🔗',
  rbac: '👥',
  ai: '🤖',
  security: '🔒',
  deployment: '🚀',
  pricing: '💰',
  mission: '🎯',
  stack: '🧰',
  limitations: '⚠️',
};

export async function GET() {
  const { rows } = await query<{
    id: string;
    category: string;
    question_variants: string[];
    status: 'yes' | 'partial' | 'no' | 'roadmap';
  }>(
    `SELECT id, category, question_variants, status
     FROM dalgo_knowledge_base
     ORDER BY category, status DESC`,
  );

  const grouped: Record<string, { id: string; question: string; status: string }[]> = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push({
      id: r.id,
      question: r.question_variants?.[0] ?? '',
      status: r.status,
    });
  }

  const categories = CATEGORY_ORDER.filter((k) => grouped[k]).map((key) => ({
    key,
    label: CATEGORY_LABELS[key] ?? key,
    icon: CATEGORY_ICONS[key] ?? '•',
    count: grouped[key].length,
    questions: grouped[key],
  }));

  return NextResponse.json({ categories });
}
