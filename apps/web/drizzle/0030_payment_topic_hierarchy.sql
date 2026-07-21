-- Payment infrastructure is a specialization of Payments, not a sibling.
DELETE FROM topic_relationships
WHERE from_topic_id='fintech' AND to_topic_id='payment-infrastructure' AND kind='parent';
--> statement-breakpoint
INSERT OR IGNORE INTO topic_relationships (from_topic_id,to_topic_id,kind,weight_basis_points)
VALUES ('payments','payment-infrastructure','parent',10000);
