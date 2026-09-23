const repositoryUrl = process.env.CI_PROJECT_URL
  ? `${process.env.CI_PROJECT_URL}.git`
  : 'https://gitlab.com/off-peak.engineer/utilities/pulsed.git';

const binaries = [
  'pulsed-linux-amd64',
  'pulsed-linux-arm64',
  'pulsed-darwin-amd64',
  'pulsed-darwin-arm64',
  'pulsed-windows-amd64.exe',
  'pulsed-windows-arm64.exe',
  'checksums.sha256'
];

module.exports = {
  branches: [process.env.CI_DEFAULT_BRANCH || 'main'],
  repositoryUrl,
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/exec', {
      prepareCmd: 'PULSED_VERSION="${nextRelease.gitTag}" sh deploy/release/build-all.sh'
    }],
    ['@semantic-release/gitlab', {
      successCommentCondition: false,
      failCommentCondition: false,
      // For generic packages, label is also the uploaded filename.
      assets: binaries.map((name) => ({
        path: `dist/${name}`,
        label: name,
        type: 'package',
        target: 'generic_package',
        packageName: 'pulsed',
        filepath: `/${name}`
      }))
    }]
  ]
};
