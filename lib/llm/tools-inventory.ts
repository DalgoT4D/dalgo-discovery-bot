import { buildToolset } from './tools';

export function buildToolsInventory(): string {
  const tools = buildToolset('inventory');
  const lines = Object.entries(tools).map(([name, t]) => {
    const desc = (t as { description?: string }).description ?? '';
    return `  • ${name} — ${desc}`;
  });
  return ['You have the following tools. Always call the relevant tool instead of inventing capabilities:', ...lines].join('\n');
}
