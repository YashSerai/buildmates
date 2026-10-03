-- Expand the temporary aggregate-only visualization fixture for world-scale density QA.
-- All added builders and projects remain private, unindexed, unpublished, and excluded from matching.

INSERT OR IGNORE INTO `topics` (`id`,`taxonomy_version_id`,`slug`,`label`) VALUES
('agent-orchestration','taxonomy-buildmates-v1','agent-orchestration','Agent orchestration'),
('agent-memory','taxonomy-buildmates-v1','agent-memory','Agent memory'),
('computer-use','taxonomy-buildmates-v1','computer-use','Computer use'),
('multimodal-ai','taxonomy-buildmates-v1','multimodal-ai','Multimodal AI'),
('vector-databases','taxonomy-buildmates-v1','vector-databases','Vector databases'),
('hybrid-search','taxonomy-buildmates-v1','hybrid-search','Hybrid search'),
('reranking','taxonomy-buildmates-v1','reranking','Reranking'),
('knowledge-graphs','taxonomy-buildmates-v1','knowledge-graphs','Knowledge graphs'),
('design-systems','taxonomy-buildmates-v1','design-systems','Design systems'),
('webgl','taxonomy-buildmates-v1','webgl','WebGL'),
('accessibility','taxonomy-buildmates-v1','accessibility','Accessibility'),
('observability','taxonomy-buildmates-v1','observability','Observability'),
('serverless','taxonomy-buildmates-v1','serverless','Serverless'),
('developer-experience','taxonomy-buildmates-v1','developer-experience','Developer experience'),
('community-platforms','taxonomy-buildmates-v1','community-platforms','Community platforms'),
('social-discovery','taxonomy-buildmates-v1','social-discovery','Social discovery'),
('creator-monetization','taxonomy-buildmates-v1','creator-monetization','Creator monetization'),
('content-automation','taxonomy-buildmates-v1','content-automation','Content automation'),
('billing-infrastructure','taxonomy-buildmates-v1','billing-infrastructure','Billing infrastructure'),
('fintech','taxonomy-buildmates-v1','fintech','Fintech'),
('event-pipelines','taxonomy-buildmates-v1','event-pipelines','Event pipelines'),
('data-warehouses','taxonomy-buildmates-v1','data-warehouses','Data warehouses'),
('robotics-software','taxonomy-buildmates-v1','robotics-software','Robotics software'),
('edge-ai','taxonomy-buildmates-v1','edge-ai','Edge AI');
--> statement-breakpoint
INSERT OR IGNORE INTO `topic_relationships` (`from_topic_id`,`to_topic_id`,`kind`,`weight_basis_points`) VALUES
('ai-agents','agent-orchestration','parent',10000),('ai-agents','agent-memory','parent',10000),
('ai-agents','computer-use','parent',10000),('ai-agents','multimodal-ai','parent',10000),
('retrieval-augmented-generation','vector-databases','parent',10000),('retrieval-augmented-generation','hybrid-search','parent',10000),
('retrieval-augmented-generation','reranking','parent',10000),('retrieval-augmented-generation','knowledge-graphs','parent',10000),
('frontend','design-systems','parent',10000),('design-creative','webgl','parent',10000),('frontend','accessibility','parent',10000),
('cloud-infrastructure','observability','parent',10000),('cloud-infrastructure','serverless','parent',10000),
('developer-tools','developer-experience','parent',10000),
('social-products','community-platforms','parent',10000),('social-products','social-discovery','parent',10000),
('creator-tools','creator-monetization','parent',10000),('creator-tools','content-automation','parent',10000),
('payments','billing-infrastructure','parent',10000),
('data-infrastructure','event-pipelines','parent',10000),('data-infrastructure','data-warehouses','parent',10000),
('robotics-hardware','robotics-software','parent',10000),('robotics-hardware','edge-ai','parent',10000);
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 253
)
INSERT INTO `users` (`id`,`status`,`operator_role`,`data_origin`,`created_at`,`updated_at`,`deleted_at`)
SELECT printf('qa_visual_user_%03d',n),'active','none','qa_fixture',1784332800000 + n,1784332800000 + n,NULL FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 253
)
INSERT INTO `profiles` (`id`,`user_id`,`display_name`,`summary`,`audience`,`cohort_scope_id`,`allow_matching`,`acceptance_mode`,`indexable`,`coarse_location`,`timezone`,`published_at`,`created_at`,`updated_at`,`project_or_interest`,`portfolio_links_json`,`location_map_opt_in`)
SELECT
  printf('qa_visual_profile_%03d',n),
  printf('qa_visual_user_%03d',n),
  'Visualization QA fixture',
  'Fictional private record used only to validate anonymous aggregate visualizations.',
  'private',NULL,0,'manual',0,
  CASE
    WHEN n BETWEEN 37 AND 44 THEN 'Vancouver'
    WHEN n BETWEEN 45 AND 51 THEN 'Burnaby'
    WHEN n BETWEEN 52 AND 57 THEN 'Surrey'
    WHEN n BETWEEN 58 AND 62 THEN 'Richmond'
    WHEN n BETWEEN 63 AND 66 THEN 'North Vancouver'
    WHEN n BETWEEN 67 AND 73 THEN 'San Francisco'
    WHEN n BETWEEN 74 AND 80 THEN 'Oakland'
    WHEN n BETWEEN 81 AND 84 THEN 'Berkeley'
    WHEN n BETWEEN 85 AND 91 THEN 'San Jose'
    WHEN n BETWEEN 92 AND 95 THEN 'Palo Alto'
    WHEN n BETWEEN 96 AND 101 THEN 'New York City'
    WHEN n BETWEEN 102 AND 107 THEN 'Jersey City'
    WHEN n BETWEEN 108 AND 111 THEN 'Newark'
    WHEN n BETWEEN 112 AND 114 THEN 'Hoboken'
    WHEN n BETWEEN 115 AND 119 THEN 'London'
    WHEN n BETWEEN 120 AND 123 THEN 'Croydon'
    WHEN n BETWEEN 124 AND 126 THEN 'Watford'
    WHEN n BETWEEN 127 AND 130 THEN 'Cambridge'
    WHEN n BETWEEN 131 AND 134 THEN 'Toronto'
    WHEN n BETWEEN 135 AND 138 THEN 'Mississauga'
    WHEN n BETWEEN 139 AND 141 THEN 'Berlin'
    WHEN n BETWEEN 142 AND 145 THEN 'Potsdam'
    WHEN n BETWEEN 146 AND 147 THEN 'Bengaluru'
    WHEN n BETWEEN 148 AND 151 THEN 'Mysuru'
    WHEN n BETWEEN 152 AND 157 THEN 'Mumbai'
    WHEN n BETWEEN 158 AND 163 THEN 'Delhi'
    WHEN n = 164 THEN 'Tokyo'
    WHEN n BETWEEN 165 AND 169 THEN 'Yokohama'
    WHEN n BETWEEN 170 AND 173 THEN 'Kawasaki'
    WHEN n BETWEEN 174 AND 176 THEN 'Chiba'
    WHEN n BETWEEN 177 AND 182 THEN 'São Paulo'
    WHEN n BETWEEN 183 AND 186 THEN 'Guarulhos'
    WHEN n BETWEEN 187 AND 189 THEN 'Osasco'
    WHEN n BETWEEN 190 AND 195 THEN 'Lagos'
    WHEN n BETWEEN 196 AND 199 THEN 'Ikeja'
    WHEN n BETWEEN 200 AND 205 THEN 'Sydney'
    WHEN n BETWEEN 206 AND 209 THEN 'Parramatta'
    WHEN n BETWEEN 210 AND 215 THEN 'Singapore'
    WHEN n BETWEEN 216 AND 219 THEN 'Johor Bahru'
    WHEN n BETWEEN 220 AND 225 THEN 'Mexico City'
    WHEN n BETWEEN 226 AND 229 THEN 'Naucalpan'
    WHEN n BETWEEN 230 AND 234 THEN 'Cape Town'
    WHEN n BETWEEN 235 AND 237 THEN 'Stellenbosch'
    WHEN n BETWEEN 238 AND 242 THEN 'Paris'
    WHEN n BETWEEN 243 AND 246 THEN 'Boulogne-Billancourt'
    WHEN n BETWEEN 247 AND 250 THEN 'Amsterdam'
    ELSE 'Utrecht'
  END,
  NULL,NULL,1784332800000 + n,1784332800000 + n,'','[]',1
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (
  SELECT 37
  UNION ALL
  SELECT n + 1 FROM fixture WHERE n < 253
)
INSERT INTO `projects` (`id`,`owner_user_id`,`slug`,`title`,`summary`,`audience`,`cohort_scope_id`,`allow_matching`,`status`,`created_at`,`updated_at`,`stage`,`indexable`,`published_at`,`deleted_at`)
SELECT
  printf('qa_visual_project_%03d',n),
  printf('qa_visual_user_%03d',n),
  printf('qa-visual-project-%03d',n),
  'Visualization QA fixture',
  'Fictional private project used only to validate anonymous aggregate topic counts.',
  'private',NULL,0,'active',1784332800000 + n,1784332800000 + n,'building',0,NULL,NULL
FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (SELECT 37 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%03d',n),'topic',
  CASE n % 9
    WHEN 0 THEN 'ai' WHEN 1 THEN 'developer-tools' WHEN 2 THEN 'consumer-products'
    WHEN 3 THEN 'social-community' WHEN 4 THEN 'productivity-workflows' WHEN 5 THEN 'design-creative'
    WHEN 6 THEN 'marketplaces-commerce' WHEN 7 THEN 'data-infrastructure' ELSE 'robotics-hardware'
  END,1784332800000 + n FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (SELECT 37 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%03d',n),'topic',
  CASE n % 24
    WHEN 0 THEN 'chatgpt' WHEN 1 THEN 'openai-platform' WHEN 2 THEN 'voice-ai' WHEN 3 THEN 'retrieval-augmented-generation'
    WHEN 4 THEN 'fine-tuning' WHEN 5 THEN 'ai-agents' WHEN 6 THEN 'mcp' WHEN 7 THEN 'ai-evals'
    WHEN 8 THEN 'frontend' WHEN 9 THEN 'backend' WHEN 10 THEN 'databases' WHEN 11 THEN 'authentication'
    WHEN 12 THEN 'deployment' WHEN 13 THEN 'mobile-apps' WHEN 14 THEN 'automation' WHEN 15 THEN 'presentations'
    WHEN 16 THEN 'growth-marketing' WHEN 17 THEN 'social-products' WHEN 18 THEN 'communities' WHEN 19 THEN 'privacy'
    WHEN 20 THEN 'creator-tools' WHEN 21 THEN 'marketplaces' WHEN 22 THEN 'payments' ELSE 'analytics'
  END,1784332800000 + n FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (SELECT 37 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%03d',n),'topic',
  CASE n % 24
    WHEN 0 THEN 'agent-orchestration' WHEN 1 THEN 'agent-memory' WHEN 2 THEN 'computer-use' WHEN 3 THEN 'multimodal-ai'
    WHEN 4 THEN 'vector-databases' WHEN 5 THEN 'hybrid-search' WHEN 6 THEN 'reranking' WHEN 7 THEN 'knowledge-graphs'
    WHEN 8 THEN 'design-systems' WHEN 9 THEN 'webgl' WHEN 10 THEN 'accessibility' WHEN 11 THEN 'observability'
    WHEN 12 THEN 'serverless' WHEN 13 THEN 'developer-experience' WHEN 14 THEN 'community-platforms' WHEN 15 THEN 'social-discovery'
    WHEN 16 THEN 'creator-monetization' WHEN 17 THEN 'content-automation' WHEN 18 THEN 'billing-infrastructure' WHEN 19 THEN 'fintech'
    WHEN 20 THEN 'event-pipelines' WHEN 21 THEN 'data-warehouses' WHEN 22 THEN 'robotics-software' ELSE 'edge-ai'
  END,1784332800000 + n FROM fixture;
--> statement-breakpoint
WITH RECURSIVE fixture(n) AS (SELECT 37 UNION ALL SELECT n + 1 FROM fixture WHERE n < 253)
INSERT OR IGNORE INTO `project_taxonomy_items` (`project_id`,`kind`,`taxonomy_item_id`,`created_at`)
SELECT printf('qa_visual_project_%03d',n),'topic',
  CASE (n * 7) % 16
    WHEN 0 THEN 'automation' WHEN 1 THEN 'frontend' WHEN 2 THEN 'backend' WHEN 3 THEN 'databases'
    WHEN 4 THEN 'deployment' WHEN 5 THEN 'social-products' WHEN 6 THEN 'communities' WHEN 7 THEN 'growth-marketing'
    WHEN 8 THEN 'payments' WHEN 9 THEN 'analytics' WHEN 10 THEN 'cloud-infrastructure' WHEN 11 THEN 'privacy'
    WHEN 12 THEN 'mcp' WHEN 13 THEN 'ai-agents' WHEN 14 THEN 'mobile-apps' ELSE 'creator-tools'
  END,1784332800000 + n FROM fixture;
