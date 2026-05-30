import { KbSeed } from './types';

// Community / engagement entries — answers that should redirect the user
// to the relevant section of dalgo.org rather than pretend the bot has
// live event/team/contact info. The bot has NO calendar integration and
// NO team directory: these entries are the honest "go talk to humans" path.

export const community: KbSeed[] = [
  // ─── EVENTS / BOOTCAMPS / WEBINARS / DATA DIALOGUES ──────────────────
  {
    category: 'community',
    question_variants: [
      'Do you have any upcoming events?',
      'Are there any upcoming bootcamps?',
      'When is the next bootcamp?',
      'Are there any upcoming webinars?',
      'When is the next data dialogues session?',
      'Do you run any programs for NGOs?',
      'How can I attend a Dalgo event?',
    ],
    canonical_answer:
      "I don't have a live calendar, but Dalgo runs recurring programs — bootcamps for NGO data leads, Data Dialogues (community sessions), and webinars. Current dates and registration links are at https://dalgo.org/events/. If you'd like, I can also flag your interest so the Dalgo team can reach out directly when the next batch opens.",
    status: 'yes',
    evidence: ['https://dalgo.org/events/'],
    source_audit_date: '2026-05-30',
    notes_for_sales:
      'No live event integration. When a user asks about specific dates, redirect to /events/ and offer request_demo to capture the lead.',
  },
  {
    category: 'community',
    question_variants: [
      'How do I register for the bootcamp?',
      'How do I sign up for a webinar?',
      'Is registration open for the next event?',
    ],
    canonical_answer:
      'Registration links for active programs live at https://dalgo.org/events/. I cannot check current availability or registration windows from here — the events page is authoritative. If registration is closed or full, you can also leave your interest with the Dalgo team via the contact page (https://dalgo.org/contact-us/) and they will reach out when the next batch opens.',
    status: 'yes',
    evidence: ['https://dalgo.org/events/', 'https://dalgo.org/contact-us/'],
    source_audit_date: '2026-05-30',
  },

  // ─── TEAM / WHO BUILDS DALGO ─────────────────────────────────────────
  {
    category: 'community',
    question_variants: [
      "Who's on the Dalgo team?",
      'Who works at Dalgo?',
      'Who are the people behind Dalgo?',
      'Can I see the Dalgo team?',
      'Who leads Dalgo?',
    ],
    canonical_answer:
      'Dalgo is built by Project Tech4Dev — ~11 people across engineering, consulting, sales, and marketing (as of late 2025). Profiles of the full team (with roles + photos) are at https://dalgo.org/team/.',
    status: 'yes',
    evidence: [
      'https://dalgo.org/team/',
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
    ],
    source_audit_date: '2026-05-30',
  },
  {
    category: 'community',
    question_variants: [
      'Can I talk to someone at Dalgo?',
      'Can I speak to a real person?',
      'Who do I contact at Dalgo?',
    ],
    canonical_answer:
      "Yes — the Dalgo team is small and responsive. Best paths: (1) book a demo right here (I can set that up), or (2) reach the team directly via https://dalgo.org/contact-us/. The team page at https://dalgo.org/team/ lists who you'd be talking to.",
    status: 'yes',
    evidence: ['https://dalgo.org/contact-us/', 'https://dalgo.org/team/'],
    source_audit_date: '2026-05-30',
  },

  // ─── CONTACT ─────────────────────────────────────────────────────────
  {
    category: 'community',
    question_variants: [
      'How do I contact Dalgo?',
      'How do I reach the Dalgo team?',
      'Where can I send a question to Dalgo?',
      'Is there an email for Dalgo?',
    ],
    canonical_answer:
      'The contact form lives at https://dalgo.org/contact-us/ — that goes directly to the Dalgo team. For most NGO-fit questions you can also just keep asking here; if it turns into a real demo conversation I can capture your details and pass them on.',
    status: 'yes',
    evidence: ['https://dalgo.org/contact-us/'],
    source_audit_date: '2026-05-30',
  },

  // ─── RESOURCES / LEARNING ────────────────────────────────────────────
  {
    category: 'community',
    question_variants: [
      'Where can I learn more about Dalgo?',
      'Do you have any learning resources?',
      'Are there any guides or tutorials?',
      'Where can I find Dalgo case studies?',
      'Do you have a blog?',
    ],
    canonical_answer:
      'Three good places, in increasing depth: (1) curated resources at https://dalgo.org/resources/ (videos, decks, summaries); (2) the Project Tech4Dev blog at https://projecttech4dev.org/ for customer stories and product updates; (3) the product documentation at https://dalgot4d.github.io/dalgo_docs/ for how-to / setup / configuration. I can also pull case studies and how-tos directly into this conversation — just ask.',
    status: 'yes',
    evidence: [
      'https://dalgo.org/resources/',
      'https://projecttech4dev.org/',
      'https://dalgot4d.github.io/dalgo_docs/',
    ],
    source_audit_date: '2026-05-30',
  },
];
