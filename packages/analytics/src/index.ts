export interface AnalyticsConfig {
  posthogKey?: string;
  feedbackWidgetUrl: string;
  feedbackTheme: 'dark' | 'light';
  feedbackAccent: string;
}

export const DEFAULT_ANALYTICS: AnalyticsConfig = {
  feedbackWidgetUrl: 'https://feedback.shipyfus.xyz/widget.js',
  feedbackTheme: 'dark',
  feedbackAccent: '#f97316',
};

export function buildFeedbackSnippet(projectName: string, config: AnalyticsConfig = DEFAULT_ANALYTICS): string {
  return `<script src="${config.feedbackWidgetUrl}" data-project="${projectName}" data-theme="${config.feedbackTheme}" data-accent="${config.feedbackAccent}"></script>`;
}

export function buildPosthogSnippet(key: string): string {
  if (!key) return '';
  return `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${key}',{api_host:'https://us.i.posthog.com',person_profiles:'always'});</script>`;
}
