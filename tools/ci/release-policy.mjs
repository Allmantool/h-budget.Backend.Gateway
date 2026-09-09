export const CONVENTIONAL_TYPES = Object.freeze([
  'build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test',
]);

export const RELEASE_RULES = Object.freeze([
  { breaking: true, release: 'major' },
  { type: 'feat', release: 'minor' },
  { type: 'fix', release: 'patch' },
  { type: 'perf', release: 'patch' },
  { type: 'revert', release: 'patch' },
  { type: 'refactor', release: 'patch' },
  { type: 'chore', release: 'patch' },
  { type: 'build', release: 'patch' },
  { type: 'ci', release: 'patch' },
  { type: 'docs', release: false },
  { type: 'style', release: false },
  { type: 'test', release: false },
]);

export const RELEASE_NOTE_TYPES = Object.freeze([
  { type: 'feat', section: 'Features', effect: 'bump' },
  { type: 'fix', section: 'Fixes', effect: 'bump' },
  { type: 'perf', section: 'Performance', effect: 'bump' },
  { type: 'revert', section: 'Reverts', effect: 'bump' },
  { type: 'refactor', section: 'Refactoring', effect: 'bump' },
  { type: 'chore', section: 'Maintenance', effect: 'bump' },
  { type: 'build', section: 'Build System', effect: 'bump' },
  { type: 'ci', section: 'Continuous Integration', effect: 'bump' },
  { type: 'docs', effect: 'hidden' },
  { type: 'style', effect: 'hidden' },
  { type: 'test', effect: 'hidden' },
]);

export const RELEASE_NOTE_WRITER_OPTIONS = Object.freeze({
  mainTemplate: `{{> header}}
{{#each noteGroups}}
### ⚠ {{title}}
{{#each notes}}
* {{text}}
{{/each}}
{{/each}}
{{#each commitGroups}}
### {{title}}
{{#each commits}}
{{> commit root=@root}}
{{/each}}
{{/each}}`,
  headerPartial: '## {{version}} ({{date}})\n\n',
  commitPartial: '* {{header}}{{#if hash}} ({{hash}}){{/if}}\n',
  footerPartial: '',
});

const technicalMaintenanceTypes = Object.freeze(CONVENTIONAL_TYPES.filter(type => type !== 'feat'));
const branchRules = Object.freeze([
  { pattern: /^(?:feature|feat)\/.+/, allowedTypes: Object.freeze(['feat']) },
  { pattern: /^(?:bug|bugfix|fix|hotfix)\/.+/, allowedTypes: Object.freeze(['fix']) },
  { pattern: /^perf\/.+/, allowedTypes: Object.freeze(['perf']) },
  { pattern: /^refactor\/.+/, allowedTypes: Object.freeze(['refactor']) },
  { pattern: /^chore\/.+/, allowedTypes: Object.freeze(['chore']) },
  { pattern: /^docs\/.+/, allowedTypes: Object.freeze(['docs']) },
  { pattern: /^test\/.+/, allowedTypes: Object.freeze(['test']) },
  { pattern: /^ci\/.+/, allowedTypes: Object.freeze(['ci']) },
  { pattern: /^build\/.+/, allowedTypes: Object.freeze(['build']) },
  { pattern: /^(?:tech|codex)\/.+/, allowedTypes: technicalMaintenanceTypes },
  { pattern: /^(?:automation\/deps|dependabot|renovate)\/.+/, allowedTypes: Object.freeze(['chore']) },
]);
const titlePattern = /^(?<type>[a-z]+)(?:\([^\)\r\n]+\))?(?<breaking>!)?: (?<description>[^\r\n]+)$/;
const releaseWeight = Object.freeze({ patch: 1, minor: 2, major: 3 });

export function parseConventionalTitle(title) {
  const match = titlePattern.exec(title);
  if (!match) return undefined;
  return { type: match.groups.type, breaking: Boolean(match.groups.breaking), supported: CONVENTIONAL_TYPES.includes(match.groups.type) };
}

function quoted(value) {
  return JSON.stringify(value);
}

function titleError(title) {
  if (!title?.trim()) return '[GW-PR-002] Empty PR title. Expected: an allowed type, optional scope and breaking marker, then ": description". Suggested correction: ci(gateway): improve CI/CD verification. Fix: edit the PR title. Recheck: the PR edited event reruns title validation.';
  const typeMatch = /^(?<type>[a-z]+)(?:\([^\)\r\n]*\))?(?:!)?:/.exec(title);
  if (typeMatch && !CONVENTIONAL_TYPES.includes(typeMatch.groups.type)) return `[GW-PR-001] Unsupported PR-title type: ${typeMatch.groups.type}. Expected: ${CONVENTIONAL_TYPES.join(', ')}, optional scope and breaking marker, then ': description'. Suggested correction: ci(gateway): improve CI/CD verification. Fix: edit the PR title; renaming the branch is not required by this error. Recheck: the PR edited event reruns title validation.`;
  if (/^[a-z]+\(\):/.test(title)) return `[GW-PR-003] Empty PR-title scope in ${quoted(title)}. Expected: a non-empty scope or no scope. Fix: edit the PR title. Recheck: the PR edited event reruns title validation.`;
  if (/^[a-z]+(?:\([^\)\r\n]+\))?!?:\s*$/.test(title)) return `[GW-PR-004] Empty PR-title description in ${quoted(title)}. Expected: text after ': '. Fix: edit the PR title. Recheck: the PR edited event reruns title validation.`;
  return `[GW-PR-005] PR-title parser rejected ${quoted(title)}. Expected: <allowed type>(<optional non-empty scope>)<optional !>: <description>. Fix: edit the PR title. Recheck: the PR edited event reruns title validation.`;
}

export function validatePullRequest(branch, title) {
  const branchRule = branchRules.find(rule => rule.pattern.test(branch));
  if (!branchRule) return `[GW-PR-006] Unsupported branch name ${quoted(branch)}. Expected: an approved prefix followed by a non-empty description. Fix: rename the branch only if its prefix is unsupported; edit the title separately. Recheck: push a new branch commit.`;
  const parsedTitle = parseConventionalTitle(title);
  if (!parsedTitle || !parsedTitle.supported) return titleError(title);
  if (!branchRule.allowedTypes.includes(parsedTitle.type)) return `[GW-PR-007] Branch ${quoted(branch)} does not allow ${parsedTitle.type}: titles. Expected for this branch: ${branchRule.allowedTypes.join(', ')}. Fix: edit the PR title; renaming the branch is not required by this error. Recheck: the PR edited event reruns title validation.`;
  return undefined;
}

export function classifyReleaseType(messages) {
  let releaseType;
  for (const message of messages) {
    const parsedTitle = parseConventionalTitle(message.split(/\r?\n/, 1)[0]);
    const breaking = parsedTitle?.breaking || /(^|\r?\n)BREAKING CHANGES?: .+/m.test(message);
    const candidate = breaking ? 'major' : RELEASE_RULES.find(rule => rule.type === parsedTitle?.type)?.release;
    if (candidate && (!releaseType || releaseWeight[candidate] > releaseWeight[releaseType])) releaseType = candidate;
  }
  return releaseType;
}

function readOption(name) {
  const optionIndex = process.argv.indexOf(name);
  return optionIndex === -1 ? undefined : process.argv[optionIndex + 1];
}

if (import.meta.main) {
  const branch = readOption('--branch');
  const title = readOption('--title');
  const error = branch && title ? validatePullRequest(branch, title) : 'Usage: node tools/ci/release-policy.mjs --branch <branch> --title <title>';
  if (error) {
    console.error(`Release-policy validation failed: ${error}`);
    process.exitCode = 1;
  }
}
