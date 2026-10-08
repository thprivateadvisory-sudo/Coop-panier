const { withProjectBuildGradle, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

const withAndroidSdk36 = (config) => {
  // Primary fix: set gradle.properties — Expo SDK 53 uses findProperty() in build.gradle
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) =>
        !(item.type === 'property' &&
          (item.key === 'android.targetSdkVersion' || item.key === 'android.compileSdkVersion'))
    );
    config.modResults.push({ type: 'property', key: 'android.targetSdkVersion', value: '36' });
    config.modResults.push({ type: 'property', key: 'android.compileSdkVersion', value: '36' });
    return config;
  });

  // Fallback: patch root build.gradle ext block (direct integer or findProperty default)
  config = withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    contents = contents.replace(/targetSdkVersion\s*=\s*\d+/g, 'targetSdkVersion = 36');
    contents = contents.replace(/compileSdkVersion\s*=\s*\d+/g, 'compileSdkVersion = 36');
    contents = contents.replace(
      /(findProperty\(['"]android\.targetSdkVersion['"]\)\s*\?:\s*)["']\d+["']/g,
      '$1"36"'
    );
    contents = contents.replace(
      /(findProperty\(['"]android\.compileSdkVersion['"]\)\s*\?:\s*)["']\d+["']/g,
      '$1"36"'
    );
    config.modResults.contents = contents;
    return config;
  });

  // Fallback: patch app/build.gradle for AGP 8+ direct syntax
  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    contents = contents.replace(/\btargetSdk\b\s*=\s*\d+/g, 'targetSdk = 36');
    contents = contents.replace(/\bcompileSdk\b\s*=\s*\d+/g, 'compileSdk = 36');
    config.modResults.contents = contents;
    return config;
  });

  return config;
};

module.exports = withAndroidSdk36;
