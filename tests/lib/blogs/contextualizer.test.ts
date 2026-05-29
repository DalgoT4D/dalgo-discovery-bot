import { describe, it, expect, vi } from 'vitest';
import { generateArticleContext } from '@/lib/blogs/contextualizer';

describe('generateArticleContext', () => {
  it('returns a 1-sentence summary by calling the injected LLM client', async () => {
    const llmMock = vi.fn().mockResolvedValue('Bhumi, a 35,000-volunteer education NGO, describes consolidating program data into Dalgo.');
    const result = await generateArticleContext(
      {
        url: 'https://example.com/bhumi/',
        title: 'Bhumi',
        author: null,
        publishedAt: null,
        excerpt: null,
        contentMd: 'Bhumi is a volunteer-driven education NGO...',
      },
      { generate: llmMock },
    );
    expect(result.length).toBeLessThan(300);
    expect(result.endsWith('.')).toBe(true);
    expect(llmMock).toHaveBeenCalledOnce();
    // The prompt should contain title and a slice of content
    const promptArg = llmMock.mock.calls[0][0];
    expect(promptArg).toContain('Bhumi');
  });

  it('truncates trailing whitespace/newlines from the model output', async () => {
    const llmMock = vi.fn().mockResolvedValue('  A one-liner.  \n\n');
    const result = await generateArticleContext(
      {
        url: 'x', title: 'x', author: null, publishedAt: null, excerpt: null, contentMd: 'x',
      },
      { generate: llmMock },
    );
    expect(result).toBe('A one-liner.');
  });
});
