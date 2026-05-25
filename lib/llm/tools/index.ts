import { searchDalgoKbTool } from './search-dalgo-kb';
import { searchDalgoBlogsTool } from './search-dalgo-blogs';
import { matchProblemPatternTool } from './match-problem-pattern';
import { fetchNgoWebsiteTool } from './fetch-ngo-website';
import { parsePdfTool } from './parse-pdf';
import { requestDemoTool } from './request-demo';
import { suggestRepliesTool } from './suggest-replies';

export function buildToolset(sessionId: string) {
  return {
    search_dalgo_kb: searchDalgoKbTool(sessionId),
    search_dalgo_blogs: searchDalgoBlogsTool(sessionId),
    match_problem_pattern: matchProblemPatternTool(sessionId),
    fetch_ngo_website: fetchNgoWebsiteTool(sessionId),
    parse_pdf: parsePdfTool(sessionId),
    request_demo: requestDemoTool(sessionId),
    suggest_replies: suggestRepliesTool(),
  };
}
