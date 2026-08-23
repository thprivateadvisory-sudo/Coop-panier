const { withAppBuildGradle, withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidFixes(config) {
  // 1. Supprime enableBundleCompression (retiré dans RN 0.76)
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /^[ \t]*enableBundleCompression[^\n]*\n?/gm,
      ''
    );
    return config;
  });

  // 2. Paramètres gradle.properties
  config = withGradleProperties(config, (config) => {
    const keysToRemove = ['newArchEnabled', 'kotlin.jvm.target.validation.mode'];
    config.modResults = config.modResults.filter(
      (item) => !keysToRemove.includes(item.key)
    );
    config.modResults.push({ type: 'property', key: 'newArchEnabled', value: 'false' });
    // Supprime les erreurs de validation JVM target avec Kotlin 2.0 (expo-camera)
    config.modResults.push({ type: 'property', key: 'kotlin.jvm.target.validation.mode', value: 'warning' });
    return config;
  });

  // 3. S'assure que compileSdkVersion=35 et kotlinVersion=2.0.21 dans le build.gradle racine
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;

      contents = contents.replace(
        /compileSdkVersion\s*=\s*\d+/g,
        'compileSdkVersion = 35'
      );
      contents = contents.replace(
        /targetSdkVersion\s*=\s*\d+/g,
        'targetSdkVersion = 35'
      );
      contents = contents.replace(
        /kotlinVersion\s*=\s*["'][^"']*["']/g,
        'kotlinVersion = "2.0.21"'
      );

      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};
