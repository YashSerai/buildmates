-- Add demo density to the anonymous Build Graph fixture.
-- These associations reference only private, unpublished, unindexed qa_visual_* projects.

WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO project_taxonomy_items (project_id,kind,taxonomy_item_id,created_at)
SELECT CASE WHEN n<37 THEN printf('qa_visual_project_%02d',n) ELSE printf('qa_visual_project_%03d',n) END,'topic',
  CASE n % 5 WHEN 0 THEN 'health-tech' WHEN 1 THEN 'climate-tech' WHEN 2 THEN 'gaming' WHEN 3 THEN 'fintech' ELSE 'robotics-hardware' END,
  1784332900000 + n FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO project_taxonomy_items (project_id,kind,taxonomy_item_id,created_at)
SELECT CASE WHEN n<37 THEN printf('qa_visual_project_%02d',n) ELSE printf('qa_visual_project_%03d',n) END,'topic',
  CASE n % 32
    WHEN 0 THEN 'digital-health' WHEN 1 THEN 'wellness-tech' WHEN 2 THEN 'clinical-ai' WHEN 3 THEN 'health-data'
    WHEN 4 THEN 'biotech-tools' WHEN 5 THEN 'energy-tech' WHEN 6 THEN 'climate-data' WHEN 7 THEN 'carbon-accounting'
    WHEN 8 THEN 'circular-economy' WHEN 9 THEN 'sustainable-hardware' WHEN 10 THEN 'gaming-ai' WHEN 11 THEN 'game-development'
    WHEN 12 THEN 'multiplayer-systems' WHEN 13 THEN 'interactive-storytelling' WHEN 14 THEN 'payment-infrastructure' WHEN 15 THEN 'fraud-risk'
    WHEN 16 THEN 'banking-infrastructure' WHEN 17 THEN 'personal-finance' WHEN 18 THEN 'computer-vision' WHEN 19 THEN 'human-robot-interaction'
    WHEN 20 THEN 'autonomous-systems' WHEN 21 THEN 'motion-design' WHEN 22 THEN 'generative-media' WHEN 23 THEN 'brand-systems'
    WHEN 24 THEN 'ecommerce' WHEN 25 THEN 'logistics-tech' WHEN 26 THEN 'trust-safety' WHEN 27 THEN 'consumer-ai'
    WHEN 28 THEN 'retrieval-evaluation' WHEN 29 THEN 'voice-ai' WHEN 30 THEN 'ai-agents' ELSE 'retrieval-augmented-generation'
  END,1784333000000 + n FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO project_taxonomy_items (project_id,kind,taxonomy_item_id,created_at)
SELECT CASE WHEN n<37 THEN printf('qa_visual_project_%02d',n) ELSE printf('qa_visual_project_%03d',n) END,'topic',
  CASE (n * 11) % 12
    WHEN 0 THEN 'ai-agents' WHEN 1 THEN 'consumer-ai' WHEN 2 THEN 'design-systems' WHEN 3 THEN 'analytics'
    WHEN 4 THEN 'privacy' WHEN 5 THEN 'automation' WHEN 6 THEN 'mcp' WHEN 7 THEN 'cloud-infrastructure'
    WHEN 8 THEN 'social-products' WHEN 9 THEN 'payments' WHEN 10 THEN 'computer-vision' ELSE 'developer-tools'
  END,1784333100000 + n FROM fixture;
--> statement-breakpoint
-- Preserve a meaningful broader-only segment so the hierarchy can account for
-- builders whose payments work has not been classified into a narrower child.
WITH RECURSIVE fixture(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO profile_topic_contributions (user_id,topic_id,updated_at)
SELECT CASE WHEN n<37 THEN printf('qa_visual_user_%02d',n) ELSE printf('qa_visual_user_%03d',n) END,'payments',1784333200000 + n
FROM fixture
WHERE n % 32 NOT IN (14,15,16,17) AND (n * 11) % 12 <> 9
LIMIT 42;
