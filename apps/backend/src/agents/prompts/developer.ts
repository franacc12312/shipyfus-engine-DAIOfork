import type { DevelopmentConfig } from '@daio/shared';
import type { Template } from '@daio/templates';

export function buildDeveloperPrompt(config: DevelopmentConfig, template?: Template): string {
  const analyticsHint = config.analytics?.enabled !== false && config.analytics?.provider !== 'none'
    ? `\n- Analytics: PostHog is pre-configured via snippet injection. If posthog-js is in the plan, initialize it in the root component.`
    : '';

  const templateHint = template
    ? `\n## Template\nThis project is based on the ${template.name} template from repo ${template.repo} (${template.description}). The template has been cloned and customized with the project name. Build on top of the existing template code — do not start from scratch.\n`
    : '';

  return `Read and execute the plan at thoughts/PLAN.md. Follow the execution instructions exactly.
${templateHint}

## Development Constraints
- Language: ${config.language}
- Framework: ${config.framework}
- Maximum files: ${config.max_files}
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}${analyticsHint}

## TDD Mode
This project uses TDD. Test files already exist in tests/. Your goal is to make ALL tests pass.
After each iteration, run the test suite and report which tests pass and which fail.
Continue iterating until all tests pass.
Check thoughts/PROGRESS.md for current test status. Update it after each iteration with passing/failing tests.

## Instructions
1. Read thoughts/PROGRESS.md to see where you left off and current test status
2. Read thoughts/PLAN.md to see the full plan
3. Run the existing test suite to see what's failing
4. Find the next unchecked task and implement it, focusing on making tests pass
5. After completing each task, mark it [x] in PLAN.md and update PROGRESS.md with test results
6. Run tests after each phase to verify your work
7. When ALL completion criteria in PLAN.md are met and ALL tests pass, output: <promise>PRODUCT COMPLETE</promise>

## Analytics & Feedback Integration
Before finishing, add this script tag to the main HTML file (index.html), placed before the closing </body> tag:
\`\`\`html
<script src="https://feedback.shipyfus.xyz/widget.js" data-project="${config.framework}" data-theme="dark" data-accent="#f97316"></script>
\`\`\`

Also add PostHog analytics to the main HTML file if a PostHog key is provided. Add this in the <head>:
${config.analytics?.provider === 'posthog' ? `\`\`\`html
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('POSTHOG_KEY', {api_host: 'https://us.i.posthog.com', person_profiles: 'always'});
</script>
\`\`\`
Note: Replace POSTHOG_KEY with the actual key from analytics constraints. If no key is configured, skip adding PostHog.` : 'No PostHog key configured — skip PostHog analytics snippet.'}

CRITICAL: Only output <promise>PRODUCT COMPLETE</promise> when the project is GENUINELY complete with all tasks done and all tests passing.`;
}
