-- Temporary, privacy-safe visualization fixture for Map and Build Graph QA.
-- These records have no handles, sessions, identity principals, public profiles,
-- indexable pages, or matching consent. Only aggregate city/topic queries see them.
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `users` (`id`,`status`,`operator_role`,`created_at`,`updated_at`,`deleted_at`)
SELECT printf('qa_visual_user_%02d',n),'active','none',1784332800000,1784332800000,NULL FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profiles` (`id`,`user_id`,`display_name`,`summary`,`audience`,`cohort_scope_id`,`allow_matching`,`acceptance_mode`,`indexable`,`coarse_location`,`timezone`,`published_at`,`created_at`,`updated_at`,`project_or_interest`,`portfolio_links_json`,`location_map_opt_in`)
SELECT
  printf('qa_visual_profile_%02d',n),
  printf('qa_visual_user_%02d',n),
  'Visualization QA fixture',
  'Fictional private record used only to validate anonymous aggregate visualizations.',
  'private',NULL,0,'manual',0,
  CASE
    WHEN n <= 8 THEN 'Vancouver'
    WHEN n <= 15 THEN 'San Francisco'
    WHEN n <= 21 THEN 'New York City'
    WHEN n <= 26 THEN 'London'
    WHEN n <= 30 THEN 'Toronto'
    WHEN n <= 33 THEN 'Berlin'
    WHEN n <= 35 THEN 'Bengaluru'
    ELSE 'Tokyo'
  END,
  NULL,NULL,1784332800000,1784332800000,'','[]',1
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `projects` (`id`,`owner_user_id`,`slug`,`title`,`summary`,`audience`,`cohort_scope_id`,`allow_matching`,`status`,`created_at`,`updated_at`,`stage`,`indexable`,`published_at`,`deleted_at`)
SELECT
  printf('qa_visual_project_%02d',n),
  printf('qa_visual_user_%02d',n),
  printf('qa-visual-project-%02d',n),
  'Visualization QA fixture',
  'Fictional private project used only to validate anonymous aggregate topic counts.',
  'private',NULL,0,'active',1784332800000 + n,1784332800000 + n,'building',0,NULL,NULL
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%02d',n),'topic',
  CASE n % 6
    WHEN 0 THEN 'ai'
    WHEN 1 THEN 'developer-tools'
    WHEN 2 THEN 'productivity-workflows'
    WHEN 3 THEN 'social-community'
    WHEN 4 THEN 'data-infrastructure'
    ELSE 'marketplaces-commerce'
  END,
  1784332800000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%02d',n),'topic',
  CASE n % 12
    WHEN 0 THEN 'ai-agents'
    WHEN 1 THEN 'frontend'
    WHEN 2 THEN 'automation'
    WHEN 3 THEN 'social-products'
    WHEN 4 THEN 'databases'
    WHEN 5 THEN 'marketplaces'
    WHEN 6 THEN 'retrieval-augmented-generation'
    WHEN 7 THEN 'backend'
    WHEN 8 THEN 'presentations'
    WHEN 9 THEN 'communities'
    WHEN 10 THEN 'analytics'
    ELSE 'payments'
  END,
  1784332800000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%02d',n),'topic',
  CASE n % 12
    WHEN 0 THEN 'mcp'
    WHEN 1 THEN 'deployment'
    WHEN 2 THEN 'ai-agents'
    WHEN 3 THEN 'growth-marketing'
    WHEN 4 THEN 'cloud-infrastructure'
    WHEN 5 THEN 'payments'
    WHEN 6 THEN 'ai-evals'
    WHEN 7 THEN 'authentication'
    WHEN 8 THEN 'automation'
    WHEN 9 THEN 'social-products'
    WHEN 10 THEN 'cloud-infrastructure'
    ELSE 'marketplaces'
  END,
  1784332800000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT printf('qa_visual_user_%02d',n),'ai',1784332800000 + n FROM fixture WHERE n <= 22;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT printf('qa_visual_user_%02d',n),'developer-tools',1784332800000 + n FROM fixture WHERE n <= 16;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT printf('qa_visual_user_%02d',n),'productivity-workflows',1784332800000 + n FROM fixture WHERE n BETWEEN 9 AND 24;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT printf('qa_visual_user_%02d',n),'social-community',1784332800000 + n FROM fixture WHERE n BETWEEN 17 AND 30;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT printf('qa_visual_user_%02d',n),'data-infrastructure',1784332800000 + n FROM fixture WHERE n >= 25;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 36
)
INSERT INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT printf('qa_visual_user_%02d',n),'marketplaces-commerce',1784332800000 + n FROM fixture WHERE n % 4 = 0;
