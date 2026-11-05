const { withAndroidManifest, withProjectBuildGradle } = require('expo/config-plugins');

const withBluetoothPermissionFix = (config) => {
  return withAndroidManifest(config, async (expoConfig) => {
    const androidManifest = expoConfig.modResults;
    const manifest = androidManifest.manifest;

    const PERMISOS_BLUETOOTH_LEGACY = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
    ];

    const PERMISOS_UBICACION_LEGACY = [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ];

    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].map((perm) => {
        const nombre = perm.$?.['android:name'];

        if (nombre && PERMISOS_BLUETOOTH_LEGACY.includes(nombre)) {
          if (perm.$) {
            delete perm.$['android:maxSdkVersion'];
          }
        }

        if (nombre === 'android.permission.BLUETOOTH_SCAN' && perm.$) {
          perm.$['android:usesPermissionFlags'] = 'neverForLocation';
        }

        if (nombre && PERMISOS_UBICACION_LEGACY.includes(nombre) && perm.$) {
          perm.$['android:maxSdkVersion'] = '30';
        }

        return perm;
      });

      const nombresExistentes = manifest['uses-permission'].map(
        (p) => p.$?.['android:name']
      );

      for (const permiso of PERMISOS_BLUETOOTH_LEGACY) {
        if (!nombresExistentes.includes(permiso)) {
          manifest['uses-permission'].push({
            $: { 'android:name': permiso },
          });
        }
      }
    }

    return expoConfig;
  });
};

const BUILD_CONFIG_MARCA = '// pocket-locker: buildConfig en librerías';
const withBuildConfigEnabled = (config) =>
  withProjectBuildGradle(config, (expoConfig) => {
    const gradle = expoConfig.modResults;
    if (gradle.language === 'groovy' && !gradle.contents.includes(BUILD_CONFIG_MARCA)) {
      gradle.contents += `
${BUILD_CONFIG_MARCA}
subprojects { subproject ->
  subproject.plugins.withId('com.android.library') {
    subproject.android.buildFeatures.buildConfig = true
  }
}
`;
    }
    return expoConfig;
  });

const { colors } = require('./tailwind.config.js').theme;
const { version } = require('./package.json');

const PROJECT_ID = '30c00fa6-7d04-44dd-8f0a-99a5bbf25f72';
const ID_APLICACION = 'com.yoakeyinn.pocketlocker';
const DESCRIPCION_USO_BLUETOOTH = 'Permite conectar con tu dispositivo de garaje';

module.exports = ({ config }) => {
  return withBuildConfigEnabled(withBluetoothPermissionFix({
    ...config,
    name: require('./src/styles/i18n/locales/es.json').pl_app_titulo,
    slug: 'pocket-locker',
    version,
    runtimeVersion: version,
    updates: {
      url: `https://u.expo.dev/${PROJECT_ID}`,
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'pocketlocker',
    splash: {
      backgroundColor: colors.beige,
      resizeMode: 'contain',
    },
    android: {
      package: ID_APLICACION,
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: colors.white,
      },
      permissions: [
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.BLUETOOTH_ADVERTISE',
      ],
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: ID_APLICACION,
    },
    plugins: [
      'expo-router',
      'expo-status-bar',
      [
        'with-rn-bluetooth-classic',
        {
          peripheralUsageDescription: DESCRIPCION_USO_BLUETOOTH,
          alwaysUsageDescription: DESCRIPCION_USO_BLUETOOTH,
        },
      ],
      'expo-font',
      'react-native-ble-plx',
      'expo-secure-store',
      [
        'expo-local-authentication',
        { faceIDPermission: 'Pocket Locker usa Face ID para proteger el acceso a la aplicación.' },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: PROJECT_ID,
      },
    },
  }));
};

