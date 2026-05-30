import { describe, it, expect } from 'vitest';
import { buildToolsInventory } from '@/lib/llm/tools-inventory';
import { buildToolset } from '@/lib/llm/tools';

describe('buildToolsInventory', () => {
  it('lists every tool registered in buildToolset by name', () => {
    const text = buildToolsInventory();
    const names = Object.keys(buildToolset('inventory-test'));
    for (const name of names) {
      expect(text).toContain(name);
    }
  });

  it('includes each tool description from the registered tools', () => {
    const text = buildToolsInventory();
    expect(text).toMatch(/Search Dalgo's capability knowledge base/i);
    expect(text).toMatch(/blog posts/i);
  });

  it('is deterministic across calls', () => {
    expect(buildToolsInventory()).toBe(buildToolsInventory());
  });
});
