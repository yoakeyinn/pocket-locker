const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Plugin de configuración que anula el atributo `android:maxSdkVersion="30"` en los
 * permisos BLUETOOTH y BLUETOOTH_ADMIN para compatibilidad nativa con Android 12+ (API 31+).
 */
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

        // 1. Quitar maxSdkVersion de BLUETOOTH y BLUETOOTH_ADMIN para Android 12+
        if (nombre && PERMISOS_BLUETOOTH_LEGACY.includes(nombre)) {
          if (perm.$) {
            delete perm.$['android:maxSdkVersion'];
          }
        }

        // 2. Asignar neverForLocation a BLUETOOTH_SCAN para no requerir GPS en Android 12+
        if (nombre === 'android.permission.BLUETOOTH_SCAN' && perm.$) {
          perm.$['android:usesPermissionFlags'] = 'neverForLocation';
        }

        // 3. Limitar permisos de ubicación a Android 10/11 (API <= 30) para no forzar GPS en Android 12+
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

module.exports = ({ config }) => {
  return withBluetoothPermissionFix({
    ...config,
    name: 'Pocket Locker',
    slug: 'pocket-locker',
    version: '1.5.0',
    runtimeVersion: '1.5.0',
    updates: {
      url: 'https://u.expo.dev/30c00fa6-7d04-44dd-8f0a-99a5bbf25f72',
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'pocketlocker',
    splash: {
      backgroundColor: '#FAF8F2',
      resizeMode: 'contain',
    },
    android: {
      package: 'com.yoakeyinn.pocketlocker',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#EDEBEC',
      },
      permissions: [
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.BLUETOOTH_ADVERTISE',
        'android.permission.USE_BIOMETRIC',
      ],
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.yoakeyinn.pocketlocker',
    },
    plugins: [
      'expo-router',
      [
        'with-rn-bluetooth-classic',
        {
          peripheralUsageDescription: 'Permite conectar con tu dispositivo de garaje',
          alwaysUsageDescription: 'Permite conectar con tu dispositivo de garaje',
        },
      ],
      'expo-font',
      'react-native-ble-plx',
      'expo-secure-store',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Permite autenticar con biometría para ver y modificar el PIN de seguridad',
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: '30c00fa6-7d04-44dd-8f0a-99a5bbf25f72',
      },
    },
  });
};

