import { searchDalgoKbTool } from './search-dalgo-kb';
import { searchDalgoBlogsTool } from './search-dalgo-blogs';
import { searchDalgoDocsTool } from './search-dalgo-docs';
import { matchProblemPatternTool } from './match-problem-pattern';
import { fetchNgoWebsiteTool } from './fetch-ngo-website';
import { requestDemoTool } from './request-demo';
import { offerGuestTourTool } from './offer-guest-tour';
import { suggestRepliesTool } from './suggest-replies';
import { flagUnproductiveTurnTool } from './flag-unproductive-turn';

export function buildToolset(sessionId: string) {
  return {
    search_dalgo_kb: searchDalgoKbTool(sessionId),
    search_dalgo_blogs: searchDalgoBlogsTool(sessionId),
    search_dalgo_docs: searchDalgoDocsTool(sessionId),
    match_problem_pattern: matchProblemPatternTool(sessionId),
    fetch_ngo_website: fetchNgoWebsiteTool(sessionId),
    request_demo: requestDemoTool(sessionId),
    offer_guest_tour: offerGuestTourTool(sessionId),
    suggest_replies: suggestRepliesTool(),
    flag_unproductive_turn: flagUnproductiveTurnTool(),
  };
}
