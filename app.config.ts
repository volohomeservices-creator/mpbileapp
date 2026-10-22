import type { ExpoConfig, ConfigContext } from 'expo/config';


const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = () => {
  if (IS_DEV) return 'VOLO (Dev)';
  if (IS_PREVIEW) return 'VOLO (Preview)';
  return 'VOLO';
};

const getBundleId = () => 'com.volohome.app';

const getVersionCode = () => {
  if (process.env.EAS_BUILD_NUMBER) {
    const parsed = parseInt(process.env.EAS_BUILD_NUMBER, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // Strictly increasing timestamp in minutes (fits within Google Play limit, never conflicts)
  return Math.floor(Date.now() / 60000);
};

export default ({ config }: ConfigContext): any => ({
  ...config,
  name: getAppName(),
  slug: 'volo-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: getBundleId(),
    supportsTablet: false,
    googleServicesFile: './GoogleService-Info.plist',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDJ3DI7eMgk6J-YkflEw7gVDqr07uwxcg',
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'VOLO needs your location to assign nearby workers and show your live position.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'VOLO uses your location in the background while you are actively on a job.',
      NSCameraUsageDescription: 'VOLO needs camera access to capture KYC documents.',
      NSPhotoLibraryUsageDescription: 'VOLO needs photo library access for profile and KYC photos.',
    },
  },
  android: {
    package: getBundleId(),
    versionCode: getVersionCode(),
    googleServicesFile: './google-services.json',
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyC7lRr_t9cXvXFx2lbNhJwQg2hRxbs9eQ8',
      },
    },
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#45016e',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'POST_NOTIFICATIONS',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/messaging',
    'expo-status-bar',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'VOLO uses your location to show available home services near you and navigate technicians to service locations.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'VOLO needs access to your photos for KYC and profile upload.',
        cameraPermission: 'VOLO needs camera access to capture KYC documents.',
      },
    ],
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#45016e',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    API_BASE_URL: process.env.API_BASE_URL,
    APP_VARIANT: process.env.APP_VARIANT,
    eas: {
      projectId: "5725c0be-01ed-44b5-b6e7-7f13143cb136",
    },
  },
  scheme: 'volo',
});
