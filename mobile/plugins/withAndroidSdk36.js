const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidSdk36 = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Force targetSdkVersion to 36 (Play Store requirement as of Sept 1 2026)
    contents = contents.replace(
      /targetSdkVersion\s*[=:]?\s*\d+/g,
      'targetSdkVersion = 36'
    );

    // Force compileSdkVersion to 36 (must be >= targetSdkVersion)
    contents = contents.replace(
      /compileSdkVersion\s*[=:]?\s*\d+/g,
      'compileSdkVersion = 36'
    );

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withAndroidSdk36;
