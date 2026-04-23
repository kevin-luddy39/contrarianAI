-- Bell Tuning Rapid Audit — warm-contact target list queries
-- Built 2026-04-23. Run in psql or paste into any Postgres client connected
-- to the DATABASE_URL. Output: ranked DM target list for the $2,500 Rapid Audit launch.
--
-- USAGE FROM LOCAL MACHINE:
--   psql "$DATABASE_URL" -f tools/lead-intel/target-queries.sql
--
-- OR FROM RENDER SHELL (if Postgres is on Render):
--   Open Render dashboard → DB instance → Shell → paste queries one at a time
--
-- Each query is self-contained. Run the ones useful to you.

-- ============================================================================
-- Q1. Pool 1 — Existing audit_requests that never converted
--     Use DM template "Pool 1" from docs/outreach/2026-04-23-rapid-audit-sku.md
-- ============================================================================

SELECT
  ar.id,
  ar.name,
  ar.email,
  ar.company,
  ar.role,
  LEFT(ar.pain, 160) AS pain_excerpt,
  ar.ai_stack,
  ar.created_at::date AS submitted_on,
  COALESCE(
    (SELECT status FROM payments p
     WHERE p.audit_request_id = ar.id
     ORDER BY created_at DESC LIMIT 1),
    'no_payment_sent'
  ) AS payment_status
FROM audit_requests ar
WHERE ar.created_at > NOW() - INTERVAL '6 months'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.audit_request_id = ar.id
      AND p.status IN ('paid', 'succeeded', 'complete')
  )
ORDER BY ar.created_at DESC
LIMIT 50;

-- ============================================================================
-- Q2. Pool 2 — Tier:star or higher contacts from Lead Intel
--     Use DM template "Pool 2" from the SKU file.
-- ============================================================================

SELECT
  c.id,
  c.name,
  c.github_handle,
  c.email,
  c.company,
  c.tier,
  c.engagement_score,
  c.icp_fit,
  c.bio,
  c.twitter,
  c.linkedin_url,
  c.first_seen::date AS first_seen_on,
  (SELECT COUNT(*) FROM intel_events e WHERE e.contact_id = c.id) AS event_count,
  (SELECT string_agg(DISTINCT e.event_type, ', ')
   FROM intel_events e WHERE e.contact_id = c.id) AS event_types
FROM contacts c
WHERE c.tier IN ('star', 'watcher', 'fork', 'issue_author', 'pr_author')
  AND c.first_seen > NOW() - INTERVAL '6 months'
ORDER BY
  CASE c.tier
    WHEN 'pr_author' THEN 1
    WHEN 'issue_author' THEN 2
    WHEN 'fork' THEN 3
    WHEN 'watcher' THEN 4
    WHEN 'star' THEN 5
    ELSE 9
  END,
  c.icp_fit DESC NULLS LAST,
  c.engagement_score DESC
LIMIT 40;

-- ============================================================================
-- Q3. Pool 2 subset — contacts with email enriched (can DM directly, not just @handle)
-- ============================================================================

SELECT
  c.id,
  c.name,
  c.email,
  c.github_handle,
  c.company,
  c.tier,
  c.icp_fit,
  c.engagement_score,
  LEFT(c.bio, 140) AS bio_excerpt
FROM contacts c
WHERE c.email IS NOT NULL
  AND c.tier IN ('star', 'watcher', 'fork', 'issue_author', 'pr_author', 'audit_request')
  AND c.first_seen > NOW() - INTERVAL '12 months'
ORDER BY c.icp_fit DESC NULLS LAST, c.engagement_score DESC
LIMIT 25;

-- ============================================================================
-- Q4. ICP-fit contacts with weak-tier (visit) but strong profile signal
--     These are "they noticed us but haven't engaged yet" — worth a cold ping
--     if their profile screams buyer (eng lead, founder, CTO at AI-ish company).
-- ============================================================================

SELECT
  c.id,
  c.name,
  c.github_handle,
  c.email,
  c.company,
  c.tier,
  c.icp_fit,
  c.bio
FROM contacts c
WHERE c.icp_fit >= 2.0           -- threshold tuned in config.js; raise to 3 for tighter
  AND c.tier IN ('visit', 'star')
  AND c.first_seen > NOW() - INTERVAL '3 months'
ORDER BY c.icp_fit DESC, c.engagement_score DESC
LIMIT 25;

-- ============================================================================
-- Q5. Recent assessments with high band — people who took the assessment
--     and scored in the "you need help" band. High buyer signal.
-- ============================================================================

SELECT
  a.id,
  a.name,
  a.email,
  a.company,
  a.score,
  a.band,
  a.created_at::date AS submitted_on
FROM assessments a
WHERE a.band IN ('at-risk', 'critical', 'red', 'high-risk')  -- adjust band names to actual schema
  AND a.created_at > NOW() - INTERVAL '6 months'
ORDER BY a.created_at DESC
LIMIT 30;

-- If your band enum is different, run this first to see actual values:
--   SELECT DISTINCT band, COUNT(*) FROM assessments GROUP BY band ORDER BY 2 DESC;

-- ============================================================================
-- Q6. Master DM queue — unified target list across audit_requests + contacts
--     Ranked by best-guess warmth. Paste-friendly for DM workflow.
-- ============================================================================

WITH pool AS (
  -- Audit request submitters (highest warmth — asked for help)
  SELECT
    'audit_request' AS source,
    ar.id::text AS source_id,
    ar.name,
    ar.email,
    ar.company,
    NULL::text AS github_handle,
    'tier1_asked_for_help'::text AS warmth_tier,
    COALESCE(ar.pain, '') AS context_excerpt,
    ar.created_at
  FROM audit_requests ar
  WHERE NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.audit_request_id = ar.id AND p.status IN ('paid','succeeded','complete')
  )
  AND ar.created_at > NOW() - INTERVAL '12 months'

  UNION ALL

  -- High-tier Lead Intel contacts with email
  SELECT
    'lead_intel' AS source,
    c.id::text AS source_id,
    c.name,
    c.email,
    c.company,
    c.github_handle,
    CASE c.tier
      WHEN 'audit_request' THEN 'tier1_asked_for_help'
      WHEN 'payment' THEN 'tier0_already_paid'
      WHEN 'pr_author' THEN 'tier2_code_contributor'
      WHEN 'issue_author' THEN 'tier2_code_contributor'
      WHEN 'fork' THEN 'tier3_code_interest'
      WHEN 'watcher' THEN 'tier3_code_interest'
      WHEN 'star' THEN 'tier4_bookmark'
      ELSE 'tier5_visit'
    END AS warmth_tier,
    COALESCE(LEFT(c.bio, 120), '') AS context_excerpt,
    c.first_seen AS created_at
  FROM contacts c
  WHERE c.email IS NOT NULL
    AND c.tier IN ('star','watcher','fork','issue_author','pr_author','audit_request')
    AND c.first_seen > NOW() - INTERVAL '12 months'

  UNION ALL

  -- Recent assessment high-band takers with email
  SELECT
    'assessment' AS source,
    a.id::text AS source_id,
    a.name,
    a.email,
    a.company,
    NULL::text AS github_handle,
    'tier2_self_diagnosed_risk'::text AS warmth_tier,
    'score=' || a.score::text || ' band=' || COALESCE(a.band,'') AS context_excerpt,
    a.created_at
  FROM assessments a
  WHERE a.band IS NOT NULL
    AND a.created_at > NOW() - INTERVAL '6 months'
)
SELECT
  warmth_tier,
  source,
  source_id,
  name,
  email,
  company,
  github_handle,
  LEFT(context_excerpt, 140) AS context,
  created_at::date AS first_contact_date
FROM pool
ORDER BY
  CASE warmth_tier
    WHEN 'tier0_already_paid' THEN 0
    WHEN 'tier1_asked_for_help' THEN 1
    WHEN 'tier2_code_contributor' THEN 2
    WHEN 'tier2_self_diagnosed_risk' THEN 3
    WHEN 'tier3_code_interest' THEN 4
    WHEN 'tier4_bookmark' THEN 5
    ELSE 6
  END,
  created_at DESC
LIMIT 75;

-- ============================================================================
-- Q7. Sanity-check: how many candidates exist per warmth tier?
-- ============================================================================

SELECT warmth_tier, COUNT(*) AS candidates FROM (
  SELECT 'tier1_asked_for_help' AS warmth_tier
  FROM audit_requests ar
  WHERE NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.audit_request_id = ar.id AND p.status IN ('paid','succeeded','complete')
  )
  AND ar.created_at > NOW() - INTERVAL '12 months'

  UNION ALL

  SELECT CASE c.tier
    WHEN 'pr_author' THEN 'tier2_code_contributor'
    WHEN 'issue_author' THEN 'tier2_code_contributor'
    WHEN 'fork' THEN 'tier3_code_interest'
    WHEN 'watcher' THEN 'tier3_code_interest'
    WHEN 'star' THEN 'tier4_bookmark'
    ELSE 'tier5_visit'
  END AS warmth_tier
  FROM contacts c
  WHERE c.email IS NOT NULL
    AND c.tier IN ('star','watcher','fork','issue_author','pr_author','audit_request')
    AND c.first_seen > NOW() - INTERVAL '12 months'

  UNION ALL

  SELECT 'tier2_self_diagnosed_risk' AS warmth_tier
  FROM assessments a
  WHERE a.band IS NOT NULL
    AND a.created_at > NOW() - INTERVAL '6 months'
) tiered
GROUP BY warmth_tier
ORDER BY candidates DESC;

-- ============================================================================
-- DM workflow (recommended order):
--
-- 1. Run Q7 first — confirms you have candidates and how many per tier.
-- 2. Run Q1 — top priority: already-asked audit_requests. Use Pool 1 template.
--    DM each with the Pool 1 template, 5 minutes each.
-- 3. Run Q3 — Lead Intel with email. Use Pool 2 template. DM each.
-- 4. Run Q6 — master queue for anyone missed. Work top-down by warmth_tier.
-- 5. Log each DM into a contact-notes field so you don't double-message.
--
-- Rate-limit yourself: 10-15 DMs per day max. Personalize each one by pasting
-- the context_excerpt into the template's "[paraphrase from their original
-- pain field]" slot. Generic DMs get zero replies.
--
-- Expected conversion:
-- - Q1 (audit_requests): 15-25% reply rate, 5-10% conversion to paid audit
-- - Q3 (Lead Intel email): 5-10% reply rate, 2-5% conversion
-- - Q4 (ICP-fit visits): 2-5% reply rate, <2% conversion
--
-- First paid audit from Q1 cohort usually within 48-72 hours of DM send.
-- ============================================================================
