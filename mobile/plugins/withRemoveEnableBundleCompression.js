const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withRemoveEnableBundleCompression(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /[ \t]*enableBundleCompression\s*=\s*(true|false)[ \t]*\n?/g,
      ''
    );
    return config;
  });
};
