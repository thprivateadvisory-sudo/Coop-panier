const { withAppBuildGradle, withGradleProperties, withProjectBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-camera@16.x still imports expo.modules.interfaces.barcodescanner.BarCodeScannerResult
// but this class no longer exists in expo-modules-core@2.5.0 (was removed with expo-barcode-scanner).
// We recreate it as a stub so expo-camera compiles.
const BARCODE_SCANNER_RESULT_JAVA = `package expo.modules.interfaces.barcodescanner;

import java.util.ArrayList;
import java.util.List;

public class BarCodeScannerResult {
  private int mType;
  private String mValue;
  private String mRaw;
  private List<Integer> mCornerPoints;
  private int mReferenceImageWidth;
  private int mReferenceImageHeight;

  public BarCodeScannerResult(int type, String value, String raw, List<Integer> cornerPoints, int referenceImageWidth, int referenceImageHeight) {
    mType = type;
    mValue = value;
    mRaw = raw;
    mCornerPoints = cornerPoints != null ? cornerPoints : new ArrayList<>();
    mReferenceImageWidth = referenceImageWidth;
    mReferenceImageHeight = referenceImageHeight;
  }

  public int getType() { return mType; }
  public String getValue() { return mValue; }
  public String getRaw() { return mRaw; }
  public List<Integer> getCornerPoints() { return mCornerPoints; }
  public void setCornerPoints(List<Integer> cornerPoints) { mCornerPoints = cornerPoints; }
  public int getReferenceImageWidth() { return mReferenceImageWidth; }
  public void setReferenceImageWidth(int width) { mReferenceImageWidth = width; }
  public int getReferenceImageHeight() { return mReferenceImageHeight; }
  public void setReferenceImageHeight(int height) { mReferenceImageHeight = height; }

  public BoundingBox getBoundingBox() {
    if (mCornerPoints == null || mCornerPoints.size() < 8) {
      return new BoundingBox(0, 0, 0, 0);
    }
    int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE;
    int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE;
    for (int i = 0; i < mCornerPoints.size(); i += 2) {
      int x = mCornerPoints.get(i);
      int y = mCornerPoints.get(i + 1);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return new BoundingBox(minX, minY, maxX - minX, maxY - minY);
  }

  public static class BoundingBox {
    public final int x;
    public final int y;
    public final int width;
    public final int height;

    public BoundingBox(int x, int y, int width, int height) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }
  }
}
`;

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
    const keysToRemove = [
      'newArchEnabled',
      'kotlin.jvm.target.validation.mode',
      'org.gradle.daemon',
      'org.gradle.jvmargs',
      'kotlin.daemon.jvm.options',
    ];
    config.modResults = config.modResults.filter(
      (item) => !keysToRemove.includes(item.key)
    );
    config.modResults.push({ type: 'property', key: 'newArchEnabled', value: 'false' });
    config.modResults.push({ type: 'property', key: 'kotlin.jvm.target.validation.mode', value: 'warning' });
    config.modResults.push({ type: 'property', key: 'org.gradle.daemon', value: 'false' });
    config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m' });
    config.modResults.push({ type: 'property', key: 'kotlin.daemon.jvm.options', value: '-Xmx2048m' });
    return config;
  });

  // 3. Enforce compileSdkVersion=35, kotlinVersion=2.0.21 dans le build.gradle racine
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      contents = contents.replace(/compileSdkVersion\s*=\s*\d+/g, 'compileSdkVersion = 35');
      contents = contents.replace(/targetSdkVersion\s*=\s*\d+/g, 'targetSdkVersion = 35');
      contents = contents.replace(/kotlinVersion\s*=\s*["'][^"']*["']/g, 'kotlinVersion = "2.0.21"');
      config.modResults.contents = contents;
    }
    return config;
  });

  // 4. Crée la classe BarCodeScannerResult manquante dans les sources android d'expo-camera
  //    (expo-camera@16.x l'importe depuis expo-barcode-scanner qui n'est plus installé)
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const barcodeDir = path.join(
        config.modRequest.projectRoot,
        'node_modules/expo-camera/android/src/main/java/expo/modules/interfaces/barcodescanner'
      );
      fs.mkdirSync(barcodeDir, { recursive: true });
      fs.writeFileSync(
        path.join(barcodeDir, 'BarCodeScannerResult.java'),
        BARCODE_SCANNER_RESULT_JAVA
      );
      return config;
    }
  ]);

  return config;
};
