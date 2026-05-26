import { PromptEditor } from '@/components/admin/prompt-editor';

const SECTION_TITLES: Record<string, string> = {
  intro_and_rules: 'Intro & Rules',
  tools_inventory: 'Tools Inventory',
  consultant_mode: 'Consultant Mode',
  dalgo_vs_3rd_party: 'Dalgo vs 3rd-Party Boundary',
  fit_assessment: 'Fit Assessment Mode',
};

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const title = SECTION_TITLES[key] ?? key;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">{title}</h2>
      <PromptEditor promptKey={key} />
    </div>
  );
}
