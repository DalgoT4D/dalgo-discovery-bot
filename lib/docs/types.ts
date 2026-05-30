export interface ParsedDocPage {
  url: string;
  title: string;
  contentMd: string;
}

export interface DocChunk {
  chunkIndex: number;
  chunkText: string;
}

export interface EmbeddedDocChunk extends DocChunk {
  embedding: number[];
}

export interface DocUpsertResult {
  kind: 'new' | 'updated' | 'skipped';
  pageId: string;
  chunkCount: number;
}

export interface DocsJobSummary {
  pagesSeen: number;
  pagesNew: number;
  pagesUpdated: number;
  pagesSkipped: number;
  error?: string;
}
