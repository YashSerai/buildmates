INSERT INTO `taxonomy_versions` (`id`,`version`,`status`,`created_at`,`activated_at`)
VALUES ('taxonomy-buildmates-v1',0,'active',1784332800000,1784332800000);
--> statement-breakpoint
INSERT INTO `topics` (`id`,`taxonomy_version_id`,`slug`,`label`) VALUES
('ai','taxonomy-buildmates-v1','ai','AI'),
('developer-tools','taxonomy-buildmates-v1','developer-tools','Developer tools'),
('consumer-products','taxonomy-buildmates-v1','consumer-products','Consumer products'),
('social-community','taxonomy-buildmates-v1','social-community','Social and community'),
('productivity-workflows','taxonomy-buildmates-v1','productivity-workflows','Productivity and workflows'),
('design-creative','taxonomy-buildmates-v1','design-creative','Design and creative'),
('marketplaces-commerce','taxonomy-buildmates-v1','marketplaces-commerce','Marketplaces and commerce'),
('data-infrastructure','taxonomy-buildmates-v1','data-infrastructure','Data and infrastructure'),
('robotics-hardware','taxonomy-buildmates-v1','robotics-hardware','Robotics and hardware'),
('chatgpt','taxonomy-buildmates-v1','chatgpt','ChatGPT'),
('openai-platform','taxonomy-buildmates-v1','openai-platform','OpenAI platform'),
('voice-ai','taxonomy-buildmates-v1','voice-ai','Voice AI'),
('retrieval-augmented-generation','taxonomy-buildmates-v1','retrieval-augmented-generation','Retrieval-augmented generation'),
('fine-tuning','taxonomy-buildmates-v1','fine-tuning','Fine-tuning'),
('ai-agents','taxonomy-buildmates-v1','ai-agents','AI agents'),
('mcp','taxonomy-buildmates-v1','mcp','Model Context Protocol'),
('ai-evals','taxonomy-buildmates-v1','ai-evals','AI evaluations'),
('frontend','taxonomy-buildmates-v1','frontend','Frontend engineering'),
('backend','taxonomy-buildmates-v1','backend','Backend engineering'),
('databases','taxonomy-buildmates-v1','databases','Databases'),
('authentication','taxonomy-buildmates-v1','authentication','Authentication'),
('deployment','taxonomy-buildmates-v1','deployment','Deployment'),
('mobile-apps','taxonomy-buildmates-v1','mobile-apps','Mobile apps'),
('automation','taxonomy-buildmates-v1','automation','Automation'),
('presentations','taxonomy-buildmates-v1','presentations','Presentations'),
('growth-marketing','taxonomy-buildmates-v1','growth-marketing','Growth and marketing'),
('social-products','taxonomy-buildmates-v1','social-products','Social products'),
('communities','taxonomy-buildmates-v1','communities','Communities'),
('privacy','taxonomy-buildmates-v1','privacy','Privacy'),
('creator-tools','taxonomy-buildmates-v1','creator-tools','Creator tools'),
('marketplaces','taxonomy-buildmates-v1','marketplaces','Marketplaces'),
('payments','taxonomy-buildmates-v1','payments','Payments'),
('analytics','taxonomy-buildmates-v1','analytics','Analytics'),
('cloud-infrastructure','taxonomy-buildmates-v1','cloud-infrastructure','Cloud infrastructure');
--> statement-breakpoint
INSERT INTO `topic_relationships` (`from_topic_id`,`to_topic_id`,`kind`,`weight_basis_points`) VALUES
('ai','chatgpt','parent',10000),('ai','openai-platform','parent',10000),('ai','voice-ai','parent',10000),
('ai','retrieval-augmented-generation','parent',10000),('ai','fine-tuning','parent',10000),('ai','ai-agents','parent',10000),
('ai','mcp','parent',10000),('ai','ai-evals','parent',10000),
('developer-tools','frontend','parent',10000),('developer-tools','backend','parent',10000),
('developer-tools','authentication','parent',10000),('developer-tools','deployment','parent',10000),('developer-tools','mobile-apps','parent',10000),
('data-infrastructure','databases','parent',10000),('data-infrastructure','analytics','parent',10000),('data-infrastructure','cloud-infrastructure','parent',10000),
('productivity-workflows','automation','parent',10000),('productivity-workflows','presentations','parent',10000),
('social-community','social-products','parent',10000),('social-community','communities','parent',10000),('social-community','growth-marketing','parent',10000),
('design-creative','creator-tools','parent',10000),('marketplaces-commerce','marketplaces','parent',10000),
('marketplaces-commerce','payments','parent',10000),('consumer-products','privacy','parent',10000);
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'ai', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%ai-%' OR lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '% ai %';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'mcp', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%mcp%' OR lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%model context protocol%';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'automation', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%automat%';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'productivity-workflows', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%workflow%';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'consumer-products', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%consumer%';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'marketplaces', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%marketplace%';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'social-products', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%social product%';
--> statement-breakpoint
INSERT OR IGNORE INTO `profile_topic_contributions` (`user_id`,`topic_id`,`updated_at`)
SELECT p.user_id, 'privacy', p.updated_at FROM profiles p WHERE lower(p.summary || ' ' || coalesce(p.project_or_interest,'')) LIKE '%privacy%';
