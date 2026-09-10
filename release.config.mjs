import { RELEASE_NOTE_TYPES, RELEASE_NOTE_WRITER_OPTIONS, RELEASE_RULES } from './tools/ci/release-policy.mjs';

const parserOpts = {
  noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
};

export const BOOTSTRAP_VERSION = '1.0.0';

// GitHub assigns an opaque `untagged-*` tag to draft releases. Keep the
// deployable tag and source in the initial body so the tag-triggered workflow
// can identify the draft without waiting for a later PATCH request.
export const GATEWAY_RELEASE_SOURCE_TEMPLATE = `<%= nextRelease.notes %>

<!-- gateway-release-source:start -->
## Gateway release source

- Tag: \`<%= nextRelease.gitTag %>\`
- Commit: \`<%= nextRelease.gitHead %>\`
- Master quality check: \`Verify master quality / Confirm common Gateway quality checks\`
<!-- gateway-release-source:end -->`;

export function isStableTag(tag) {
  return /^v\d+\.\d+\.\d+$/.test(tag);
}

export default {
  branches: ['master'],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      { preset: 'conventionalcommits', parserOpts, releaseRules: RELEASE_RULES },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        parserOpts,
        presetConfig: { types: RELEASE_NOTE_TYPES },
        writerOpts: RELEASE_NOTE_WRITER_OPTIONS,
      },
    ],
    [
      '@semantic-release/github',
      {
        releaseName: '${nextRelease.gitTag}',
        releaseBodyTemplate: GATEWAY_RELEASE_SOURCE_TEMPLATE,
        draftRelease: true,
        successCommentCondition: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
    './tools/ci/release-observer.mjs',
  ],
};
