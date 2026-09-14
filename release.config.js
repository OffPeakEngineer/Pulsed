const repositoryUrl = process.env.CI_PROJECT_URL
  ? `${process.env.CI_PROJECT_URL}.git`
  : 'https://gitlab.com/off-peak.engineer/utilities/pulsed.git';

const binaries = [
  ['pulsed-linux-amd64', 'Linux amd64 binary'],
  ['pulsed-linux-arm64', 'Linux arm64 binary'],
  ['pulsed-darwin-amd64', 'macOS Intel binary'],
  ['pulsed-darwin-arm64', 'macOS Apple Silicon binary'],
  ['pulsed-windows-amd64.exe', 'Windows amd64 binary'],
  ['pulsed-windows-arm64.exe', 'Windows arm64 binary'],
  ['checksums.sha256', 'SHA-256 checksums']
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
      assets: binaries.map(([name, label]) => ({
        path: `dist/${name}`,
        label,
        type: 'package',
        target: 'generic_package',
        packageName: 'pulsed',
        filepath: `/${name}`
      }))
    }]
  ]
};
