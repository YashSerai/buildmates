-- Temporary, reversible Connection density for the anonymous Map QA fixture.
-- The records reference only private qa_visual_* users and expose aggregate counts, never identities.

WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 132
)
INSERT OR IGNORE INTO `match_pairs` (`id`,`user_a_id`,`user_b_id`,`created_at`)
SELECT
  printf('qa_visual_pair_%03d',n),
  printf('qa_visual_user_%03d',n),
  printf('qa_visual_user_%03d',n + 121),
  1784332900000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 132
)
INSERT OR IGNORE INTO `match_proposals` (`id`,`match_pair_id`,`attempt_number`,`evidence_version_a`,`evidence_version_b`,`acceptance_mode_a`,`acceptance_mode_b`,`explanation_a_json`,`explanation_b_json`,`shared_explanation_json`,`state`,`expires_at`,`terminal_at`,`created_at`)
SELECT
  printf('qa_visual_proposal_%03d',n),
  printf('qa_visual_pair_%03d',n),
  1,1,1,'manual','manual','{}','{}','{}','matched',
  1786924900000 + n,
  1784333000000 + n,
  1784332900000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 132
)
INSERT OR IGNORE INTO `matches` (`id`,`match_pair_id`,`proposal_id`,`matched_at`)
SELECT
  printf('qa_visual_match_%03d',n),
  printf('qa_visual_pair_%03d',n),
  printf('qa_visual_proposal_%03d',n),
  1784333000000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 132
)
INSERT OR IGNORE INTO `connections` (`id`,`match_pair_id`,`match_id`,`state`,`created_at`,`updated_at`)
SELECT
  printf('qa_visual_connection_%03d',n),
  printf('qa_visual_pair_%03d',n),
  printf('qa_visual_match_%03d',n),
  'active',
  1784333000000 + n,
  1784333000000 + n
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 132
), sides(connection_id,user_id,created_at) AS (
  SELECT printf('qa_visual_connection_%03d',n),printf('qa_visual_user_%03d',n),1784333000000 + n FROM fixture
  UNION ALL
  SELECT printf('qa_visual_connection_%03d',n),printf('qa_visual_user_%03d',n + 121),1784333000000 + n FROM fixture
)
INSERT OR IGNORE INTO `connection_sides` (`connection_id`,`user_id`,`muted`,`renewed_relevance_enabled`,`created_at`,`updated_at`)
SELECT connection_id,user_id,0,1,created_at,created_at FROM sides;


