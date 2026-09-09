import { readFile } from 'node:fs/promises';

const markerPrefix = 'home-ledger:gateway-publication';

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Publication report is missing ${field}.`);
  }
  return value;
}

export function validatePublication(report) {
  if (report?.finalOutcome !== 'PUBLISHED') {
    throw new Error('Publication reporting requires a verified PUBLISHED delivery result.');
  }
  if (!/^v\d+\.\d+\.\d+$/.test(requireString(report.gitTag, 'gitTag'))) {
    throw new Error('Publication report has an invalid stable tag.');
  }
  if (!/^[0-9a-f]{40}$/i.test(requireString(report.sourceSha, 'sourceSha'))) {
    throw new Error('Publication report has an invalid released source SHA.');
  }
  if (!/^sha256:[0-9a-f]{64}$/i.test(requireString(report.imageDigest, 'imageDigest'))) {
    throw new Error('Publication report has an invalid image digest.');
  }
  if (!Number.isSafeInteger(Number(report.releaseId)) || Number(report.releaseId) < 1) {
    throw new Error('Publication report has an invalid GitHub Release ID.');
  }
  for (const field of ['releaseUrl', 'sourceUrl', 'workflowUrl', 'environmentUrl', 'imageVersionTag', 'imageDigestReference', 'releasePublishedAt']) {
    requireString(report[field], field);
  }
  if (report.operationKind !== 'registry-publication' || report.deploymentStatus !== 'success') {
    throw new Error('Publication report does not describe a verified registry publication.');
  }
  return report;
}

export function publicationMarker(report) {
  validatePublication(report);
  return `<!-- ${markerPrefix}:${report.gitTag}:production -->`;
}

export function selectMergedPullRequests(associations, repository, baseBranch = 'master') {
  const matches = new Map();
  for (const pullRequest of associations) {
    if (!Number.isSafeInteger(pullRequest?.number) || pullRequest.number < 1
      || pullRequest.state !== 'closed' || !pullRequest.merged_at
      || pullRequest.base?.ref !== baseBranch || pullRequest.base?.repo?.full_name !== repository
      || typeof pullRequest.html_url !== 'string') {
      continue;
    }
    matches.set(pullRequest.number, { number: pullRequest.number, url: pullRequest.html_url });
  }
  return [...matches.values()].sort((left, right) => left.number - right.number);
}

export function renderPublicationComment(report) {
  validatePublication(report);
  return `${publicationMarker(report)}
## Gateway ${report.gitTag} published to Docker Hub

This pull request is included in ${report.gitTag}.

| Detail | Value |
|---|---|
| GitHub Release | [${report.gitTag}](${report.releaseUrl}) |
| Docker image | \`${report.imageVersionTag}\` |
| Immutable pull reference | \`${report.imageDigestReference}\` |
| Source | [${report.sourceSha}](${report.sourceUrl}) |
| Environment | [production publication record](${report.environmentUrl}) — registry publication |
| Verification/run | [run ${report.runId}, attempt ${report.runAttempt}](${report.workflowUrl}) |
| Published | \`${report.releasePublishedAt}\` |

Docker Hub publication is verified. Runtime deployment is not configured.`.trimEnd();
}

export function planCommentUpsert(comments, report) {
  const marker = publicationMarker(report);
  const owned = comments.filter(comment => comment?.user?.login === 'github-actions[bot]' && comment.body?.includes(marker));
  if (owned.length > 1) {
    throw new Error(`Found multiple automation-owned publication comments for ${report.gitTag}.`);
  }
  const body = renderPublicationComment(report);
  if (owned.length === 0) {
    return { action: 'create', marker, body };
  }
  return owned[0].body === body
    ? { action: 'unchanged', marker, body, commentId: owned[0].id, commentUrl: owned[0].html_url }
    : { action: 'update', marker, body, commentId: owned[0].id, commentUrl: owned[0].html_url };
}

export function renderPublicationSummary(report, comments) {
  validatePublication(report);
  const related = comments.length === 0
    ? 'No matching merged pull requests were associated with the verified release range.'
    : comments.map(comment => `- PR [#${comment.number}](${comment.url}) — [publication comment](${comment.commentUrl})`).join('\n');
  return `# Gateway ${report.gitTag} published to Docker Hub

| Detail | Value |
|---|---|
| GitHub Release | [${report.gitTag}](${report.releaseUrl}) |
| Docker image | \`${report.imageVersionTag}\` |
| Immutable pull reference | \`${report.imageDigestReference}\` |
| Source | [${report.sourceSha}](${report.sourceUrl}) |
| Environment | [production publication record](${report.environmentUrl}) — registry publication |
| Verification/run | [run ${report.runId}, attempt ${report.runAttempt}](${report.workflowUrl}) |
| Published | \`${report.releasePublishedAt}\` |

## Related pull requests

${related}

Docker Hub publication is verified. Runtime deployment is not configured.
`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'validate' && args.length === 1) {
    process.stdout.write(`${JSON.stringify(validatePublication(await readJson(args[0])))}\n`);
  } else if (command === 'select-prs' && args.length >= 2) {
    process.stdout.write(`${JSON.stringify(selectMergedPullRequests(await readJson(args[0]), args[1], args[2]))}\n`);
  } else if (command === 'comment-plan' && args.length === 2) {
    process.stdout.write(`${JSON.stringify(planCommentUpsert(await readJson(args[0]), await readJson(args[1])))}\n`);
  } else if (command === 'summary' && args.length === 2) {
    process.stdout.write(renderPublicationSummary(await readJson(args[0]), await readJson(args[1])));
  } else {
    throw new Error('Usage: publication-report.mjs validate <report> | select-prs <associations> <repository> [base] | comment-plan <comments> <report> | summary <report> <comments>');
  }
}
