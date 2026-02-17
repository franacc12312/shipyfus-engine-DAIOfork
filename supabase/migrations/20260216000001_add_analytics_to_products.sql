ALTER TABLE products ADD COLUMN analytics_enabled boolean DEFAULT false;
ALTER TABLE products ADD COLUMN posthog_project_id text;
