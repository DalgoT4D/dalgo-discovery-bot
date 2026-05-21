import { KbSeed } from './types';

export const rbac: KbSeed[] = [
  {
    category: 'rbac',
    question_variants: ['Can multiple users share one Dalgo workspace?'],
    canonical_answer:
      'Yes — multi-org with isolated workspaces; invite users by email.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/models/org.py',
      'core/orguserfunctions.py:create_orguser()',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['What user roles are available?'],
    canonical_answer:
      'Account Manager, Pipeline Manager, Analyst, and Guest roles. Plus internal Platform Admin and Consultant roles for Dalgo staff.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/models/role_based_access.py',
      'webapp_v2/.../UserManagement.tsx',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Can I invite team members via email?'],
    canonical_answer: 'Yes — email-based invites with email verification.',
    status: 'yes',
    evidence: ['core/orguserfunctions.py', 'app/invitations/page.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Can I assign different permissions to different users?'],
    canonical_answer:
      'Yes — fine-grained `Permission` and `RolePermission` mapping with `useUserPermissions` hook used throughout the app.',
    status: 'yes',
    evidence: ['models/role_based_access.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Is there a password reset flow?'],
    canonical_answer: 'Yes — self-service password reset via email link.',
    status: 'yes',
    evidence: ['core/orguserfunctions.py:request_reset_password()'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Can each user have their own default landing dashboard?'],
    canonical_answer: 'Yes — per-user `landing_dashboard` setting.',
    status: 'yes',
    evidence: ['models/org_user.py:landing_dashboard'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Does Dalgo support multiple organizations in one deployment?'],
    canonical_answer:
      'Yes — multi-org architecture is core to Dalgo, with URL-friendly org slugs.',
    status: 'yes',
    evidence: ['models/org.py:slug'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Is data isolated between organizations?'],
    canonical_answer:
      'Yes — org-level data isolation enforced at the API level via the `x-dalgo-org` header.',
    status: 'yes',
    evidence: ['webapp_v2/CLAUDE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'rbac',
    question_variants: ['Do I sign in with Google?'],
    canonical_answer:
      'Email/password is the primary path. Google OAuth is supported specifically for Superset integration. Confirm whether SSO is available for main app login.',
    status: 'partial',
    evidence: [
      'OrgVizLoginType.GOOGLE_AUTH (Superset)',
      'app/login/page.tsx (email/password)',
    ],
    notes_for_sales: 'Confirm SSO availability for main app login with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
];
