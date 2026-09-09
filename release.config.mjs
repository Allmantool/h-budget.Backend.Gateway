import { RELEASE_NOTE_TYPES, RELEASE_NOTE_WRITER_OPTIONS, RELEASE_RULES } from './tools/ci/release-policy.mjs';

const parserOpts = {
  noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
};

export const BOOTSTRAP_VERSION = '1.0.0';

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
        draftRelease: true,
        successCommentCondition: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
