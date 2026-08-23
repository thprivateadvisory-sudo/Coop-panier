const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

module.exports = function withAndroidFixes(config) {
  // 1. Supprime enableBundleCompression (retiré dans RN 0.76)
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /^[ \t]*enableBundleCompression[^\n]*\n?/gm,
      ''
    );
    return config;
  });

  // 2. Désactive la nouvelle architecture (packages natifs pas encore compatibles)
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== 'newArchEnabled'
    );
    config.modResults.push({ type: 'property', key: 'newArchEnabled', value: 'false' });
    return config;
  });

  return config;
};
