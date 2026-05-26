import { PromptEditor } from '@/components/admin/prompt-editor';
import { PROMPT_SECTION_TITLES } from '@/lib/admin/prompt-sections';

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const title = PROMPT_SECTION_TITLES[key] ?? key;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">{title}</h2>
      <PromptEditor promptKey={key} />
    </div>
  );
}
