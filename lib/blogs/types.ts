// lib/blogs/types.ts

export interface PostRef {
  url: string;
  category: string;
  listingExcerpt?: string;
}

export interface RawPost {
  url: string;
  html: string;
  fetchedAt: Date;
  fromCache: boolean;
}

export interface ParsedArticle {
  url: string;
  title: string;
  author: string | null;
  publishedAt: string | null;   // ISO date 'YYYY-MM-DD' or null
  excerpt: string | null;
  contentMd: string;
}

export interface Chunk {
  chunkIndex: number;
  chunkText: string;
  sectionHeading?: string;
}

export interface EmbeddedChunk extends Chunk {
  contextualText: string;
  embedding: number[];
}

export interface UpsertResult {
  kind: 'new' | 'updated' | 'skipped';
  articleId: string;
  chunkCount: number;
}

export interface JobSummary {
  jobId: string;
  postsSeen: number;
  postsNew: number;
  postsUpdated: number;
  postsSkipped: number;
  error?: string;
}
