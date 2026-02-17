import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The minified PostHog snippet that gets injected into product HTML.
 * Uses the standard PostHog JS loader pattern.
 */
function getPostHogSnippet(apiKey: string, host: string): string {
  return `<script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${apiKey}',{api_host:'${host}',person_profiles:'identified_only'})
</script>`;
}

/**
 * Find index.html files recursively in a directory.
 * Looks in common build output locations first.
 */
function findHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  const priorityDirs = ['dist', 'build', 'out', '.next', 'public'];

  // Check priority directories first
  for (const subdir of priorityDirs) {
    const candidate = join(dir, subdir, 'index.html');
    try {
      statSync(candidate);
      results.push(candidate);
    } catch {
      // not found, continue
    }
  }

  // Check root index.html
  const rootCandidate = join(dir, 'index.html');
  try {
    statSync(rootCandidate);
    if (!results.includes(rootCandidate)) {
      results.push(rootCandidate);
    }
  } catch {
    // not found
  }

  // If nothing found in priority dirs, do a shallow recursive search (max 3 levels)
  if (results.length === 0) {
    findHtmlRecursive(dir, results, 0, 3);
  }

  return results;
}

function findHtmlRecursive(dir: string, results: string[], depth: number, maxDepth: number): void {
  if (depth >= maxDepth) return;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile() && entry === 'index.html') {
          results.push(fullPath);
        } else if (stat.isDirectory()) {
          findHtmlRecursive(fullPath, results, depth + 1, maxDepth);
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // skip inaccessible directories
  }
}

export interface InjectionResult {
  injected: boolean;
  filesModified: string[];
  error?: string;
}

/**
 * Injects the PostHog tracking snippet into built product HTML files.
 * This is the "guaranteed" analytics layer — runs as pipeline code, not agent code.
 */
export function injectPostHogSnippet(
  productDir: string,
  apiKey: string,
  host = 'https://us.i.posthog.com',
): InjectionResult {
  if (!apiKey) {
    return { injected: false, filesModified: [], error: 'No PostHog API key provided' };
  }

  const htmlFiles = findHtmlFiles(productDir);
  if (htmlFiles.length === 0) {
    return { injected: false, filesModified: [], error: 'No index.html found — analytics skipped (CLI tool or library)' };
  }

  const snippet = getPostHogSnippet(apiKey, host);
  const modified: string[] = [];

  for (const file of htmlFiles) {
    try {
      let content = readFileSync(file, 'utf-8');

      // Skip if already injected
      if (content.includes('posthog.init(')) continue;

      // Inject before </head> if present, otherwise before </body>
      if (content.includes('</head>')) {
        content = content.replace('</head>', `${snippet}\n</head>`);
      } else if (content.includes('</body>')) {
        content = content.replace('</body>', `${snippet}\n</body>`);
      } else {
        // No standard HTML structure — prepend snippet
        content = snippet + '\n' + content;
      }

      writeFileSync(file, content, 'utf-8');
      modified.push(relative(productDir, file));
    } catch {
      // Skip files we can't read/write
    }
  }

  return {
    injected: modified.length > 0,
    filesModified: modified,
  };
}

export interface AnalyticsSummary {
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  topPages: Array<{ path: string; views: number }>;
  period: { start: string; end: string };
}

/**
 * Fetches analytics summary from PostHog API.
 * Uses the PostHog personal API key for authentication.
 */
export async function fetchAnalyticsSummary(
  apiKey: string,
  host: string,
  projectId?: string,
  daysBack = 7,
): Promise<AnalyticsSummary | null> {
  if (!apiKey) return null;

  const baseUrl = host.replace(/\/$/, '');
  const projectPath = projectId ? `/api/projects/${projectId}` : '/api/projects/@current';
  const now = new Date();
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const dateFrom = start.toISOString().split('T')[0];
  const dateTo = now.toISOString().split('T')[0];

  try {
    // Fetch pageview trend
    const trendRes = await fetch(`${baseUrl}${projectPath}/insights/trend/?events=[{"id":"$pageview"}]&date_from=${dateFrom}&date_to=${dateTo}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!trendRes.ok) {
      return null;
    }

    const trendData = await trendRes.json() as { result?: Array<{ count: number; data: number[] }> };
    const pageViews = trendData.result?.[0]?.count ?? 0;

    // Fetch unique persons
    const personsRes = await fetch(`${baseUrl}${projectPath}/insights/trend/?events=[{"id":"$pageview","math":"dau"}]&date_from=${dateFrom}&date_to=${dateTo}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    let uniqueVisitors = 0;
    if (personsRes.ok) {
      const personsData = await personsRes.json() as { result?: Array<{ count: number }> };
      uniqueVisitors = personsData.result?.[0]?.count ?? 0;
    }

    return {
      pageViews,
      uniqueVisitors,
      sessions: 0, // Would need a separate query
      topPages: [], // Would need a breakdown query
      period: { start: dateFrom, end: dateTo },
    };
  } catch {
    return null;
  }
}
