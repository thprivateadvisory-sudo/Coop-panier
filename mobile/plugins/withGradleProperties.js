const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withCustomGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    const set = (key, value) => {
      const idx = props.findIndex((p) => p.type === 'property' && p.key === key);
      const entry = { type: 'property', key, value };
      if (idx >= 0) props[idx] = entry;
      else props.push(entry);
    };

    // Disable Gradle daemon to prevent "Could not receive a message from the daemon" crash
    set('org.gradle.daemon', 'false');
    // Increase JVM heap for Gradle
    set('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError');
    // Increase Kotlin daemon heap
    set('kotlin.daemon.jvm.options', '-Xmx2048m');

    return config;
  });
};
