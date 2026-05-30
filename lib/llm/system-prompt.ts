import { getPrompt } from '@/lib/llm/prompts';
import { buildToolsInventory } from '@/lib/llm/tools-inventory';

export async function staticSystem(): Promise<string> {
  const [identity, rules, consultant, boundary, fit] = await Promise.all([
    getPrompt('identity'),
    getPrompt('rules'),
    getPrompt('consultant_mode'),
    getPrompt('dalgo_vs_3rd_party'),
    getPrompt('fit_assessment'),
  ]);
  const tools = buildToolsInventory();
  return [identity, tools, rules, consultant, boundary, fit].join('\n\n');
}

export function ngoContextBlock(opts: {
  ngo_summary?: string | null;
  ngo_systems?: string | null;
  data_types?: string[] | null;
}): string {
  const lines = [
    opts.ngo_summary ? `NGO summary (from their website): ${opts.ngo_summary}` : null,
    opts.ngo_systems ? `Systems they use today: ${opts.ngo_systems}` : null,
    opts.data_types?.length ? `Data they work with: ${opts.data_types.join(', ')}` : null,
  ].filter(Boolean);
  return lines.length ? `NGO context:\n${lines.join('\n')}` : '';
}

export async function buildSystemPrompt(
  opts: Parameters<typeof ngoContextBlock>[0],
): Promise<string> {
  const staticPart = await staticSystem();
  const ngo = ngoContextBlock(opts);
  return ngo ? `${staticPart}\n\n${ngo}` : staticPart;
}
