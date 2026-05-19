-- seed.sql — Development seed data for Desygn AI
-- Run with: supabase db reset (auto-applies migrations + seed)
-- Or manually: psql -f supabase/seed.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Demo project
-- ═══════════════════════════════════════════════════════════════════════════════

insert into public.projects (id, user_id, name) values
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000099',
   'Demo — Landing Page Audit')
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Design context version
-- ═══════════════════════════════════════════════════════════════════════════════

insert into public.design_context_versions (id, project_id, source, version_number, context_json) values
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'manual-spec',
   1,
   '{
     "screens": [
       { "name": "Hero Section", "width": 1440, "height": 900, "components": 12 },
       { "name": "Features Grid", "width": 1440, "height": 1200, "components": 24 },
       { "name": "Pricing Table", "width": 1440, "height": 800, "components": 18 }
     ],
     "designSystem": "Material Design 3",
     "tokens": { "colors": 28, "typography": 8, "spacing": 12 }
   }'::jsonb)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Audit run with checklist results
-- ═══════════════════════════════════════════════════════════════════════════════

insert into public.audit_runs (id, project_id, design_context_version_id, source, overall_score, status) values
  ('00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'manual-spec',
   78,
   'completed')
on conflict (id) do nothing;

insert into public.checklist_results (audit_run_id, check_id, status, score, severity, confidence, reason) values
  ('00000000-0000-0000-0000-000000000003', 'naming-convention',   'pass', 0.9,  'low',      0.95, 'All layers follow BEM naming convention'),
  ('00000000-0000-0000-0000-000000000003', 'color-contrast',      'fail', 0.3,  'critical', 0.88, 'Hero subtitle has 3.2:1 contrast ratio (needs 4.5:1)'),
  ('00000000-0000-0000-0000-000000000003', 'touch-target',        'warn', 0.6,  'high',     0.82, 'CTA button is 38px height (needs 44px minimum)'),
  ('00000000-0000-0000-0000-000000000003', 'heading-hierarchy',   'pass', 1.0,  'medium',   0.97, 'H1 > H2 > H3 hierarchy is correct'),
  ('00000000-0000-0000-0000-000000000003', 'responsive-variants', 'pass', 0.85, 'medium',   0.90, '3/4 breakpoints defined (missing tablet landscape)'),
  ('00000000-0000-0000-0000-000000000003', 'token-usage',         'warn', 0.5,  'high',     0.78, '12 hardcoded colors found, should use design tokens'),
  ('00000000-0000-0000-0000-000000000003', 'alt-text',            'fail', 0.2,  'critical', 0.92, '5 images missing alt text'),
  ('00000000-0000-0000-0000-000000000003', 'spacing-consistency', 'pass', 0.95, 'low',      0.88, 'Spacing follows 8px grid system')
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Agent run log
-- ═══════════════════════════════════════════════════════════════════════════════

insert into public.agent_runs (project_id, provider, agent_type, status, cost_usd, latency_ms) values
  ('00000000-0000-0000-0000-000000000001', 'openai',    'DesignAuditAgent',     'completed', 0.012, 2340),
  ('00000000-0000-0000-0000-000000000001', 'openai',    'AccessibilityAgent',   'completed', 0.008, 1820),
  ('00000000-0000-0000-0000-000000000001', 'anthropic', 'DesignSystemAgent',    'completed', 0.015, 3100),
  ('00000000-0000-0000-0000-000000000001', 'openai',    'ScoreAgent',           'completed', 0.003,  450),
  ('00000000-0000-0000-0000-000000000001', 'anthropic', 'RecommendAgent',       'completed', 0.011, 2800),
  ('00000000-0000-0000-0000-000000000001', 'openai',    'FixPlannerAgent',      'completed', 0.009, 1950),
  ('00000000-0000-0000-0000-000000000001', 'openai',    'IssueWriterAgent',     'completed', 0.007, 1200),
  ('00000000-0000-0000-0000-000000000001', 'local',     'MemoryAgent',          'completed', 0.000,  180)
on conflict do nothing;
