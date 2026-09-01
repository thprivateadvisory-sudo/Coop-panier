const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

// Expo SDK 53 sets targetSdkVersion/compileSdkVersion in the ROOT build.gradle's ext block.
// The app/build.gradle only references them. We must patch the root build.gradle.
const withAndroidSdk36 = (config) => {
  // Patch root build.gradle: ext { targetSdkVersion = 35 } → 36
  config = withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    contents = contents.replace(/targetSdkVersion\s*=\s*\d+/g, 'targetSdkVersion = 36');
    contents = contents.replace(/compileSdkVersion\s*=\s*\d+/g, 'compileSdkVersion = 36');
    config.modResults.contents = contents;
    return config;
  });

  // Patch app/build.gradle too in case targetSdk is set directly (AGP 8+ syntax)
  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    // Match "targetSdk = 35" but NOT "targetSdkVersion" (word boundary)
    contents = contents.replace(/\btargetSdk\b\s*=\s*\d+/g, 'targetSdk = 36');
    contents = contents.replace(/\bcompileSdk\b\s*=\s*\d+/g, 'compileSdk = 36');
    config.modResults.contents = contents;
    return config;
  });

  return config;
};

module.exports = withAndroidSdk36;
