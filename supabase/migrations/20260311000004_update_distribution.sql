-- Update distribution config to support multiple platforms
UPDATE public.constraints 
SET config = '{"enabled": true, "platforms": ["twitter", "reddit", "hackernews"], "redditDraftMode": true, "autoPost": {"twitter": false, "reddit": false, "hackernews": false}}'
WHERE department = 'distribution';
