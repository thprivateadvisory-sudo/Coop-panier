const { withAppBuildGradle } = require('@expo/config-plugins');

// React Native 0.76 removed enableBundleCompression from ReactExtension.
// Some config plugins (Stripe SDK) still inject it, causing Gradle to fail.
// This plugin removes the stale property before the build.
module.exports = function withRemoveEnableBundleCompression(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /^[ \t]*enableBundleCompression[^\n]*\n?/gm,
      ''
    );
    return config;
  });
};
