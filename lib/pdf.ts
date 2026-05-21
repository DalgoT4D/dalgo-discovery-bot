import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { redactPii } from './pii-redact';

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const pageText = tc.items
      .map(i => ('str' in i ? (i as { str: string }).str : ''))
      .join(' ');
    text += (text ? '\n\n' : '') + pageText;
  }
  await doc.destroy();

  return redactPii(text).slice(0, 8000);
}
