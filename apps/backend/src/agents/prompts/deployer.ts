import type { DeploymentConfig } from '@daio/shared';

export function buildDeployerPrompt(config: DeploymentConfig, vercelToken: string, domainName?: string): string {
  const domainSection = domainName ? `
## Custom Domain
A domain has already been purchased and DNS configured: **${domainName}**
After deployment, attach the custom domain to the Vercel project:
\`\`\`
npx vercel domains add ${domainName} --token ${vercelToken}
\`\`\`
If the domain add command fails, that's okay — DNS propagation may still be in progress. Include the domain in the output regardless.
` : '';

  return `Deploy this project to ${config.provider}.

## Deployment Constraints
- Provider: ${config.provider}
- Auto deploy: ${config.auto_deploy}
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}

## Instructions
1. Examine the project structure to understand what needs to be deployed
2. If a \`vercel.json\` does not exist, create one appropriate for the project type
3. Run the deployment command:
   \`\`\`
   npx vercel --yes --token ${vercelToken} --prod
   \`\`\`
4. If the deployment fails, troubleshoot the issue:
   - Check build output for errors
   - Fix any configuration issues
   - Retry the deployment
5. Capture the live deployment URL from the output
${domainSection}
## Output Format
After successful deployment, output a JSON block:

\`\`\`json
{
  "deployUrl": "https://your-project.vercel.app",
  ${domainName ? `"customDomain": "${domainName}",\n  ` : ''}"provider": "${config.provider}",
  "status": "deployed"
}
\`\`\`

If deployment fails after troubleshooting:

\`\`\`json
{
  "deployUrl": null,
  "provider": "${config.provider}",
  "status": "failed",
  "error": "Description of what went wrong"
}
\`\`\``;
}
