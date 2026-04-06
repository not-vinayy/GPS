import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trace.fitness',
  appName: 'Trace',
  webDir: 'dist',
  plugins: {
    Geolocation: {
      iosLocationAlwaysUsageDescription:
        'Trace needs your location to record runs in the background.',
      iosLocationWhenInUseUsageDescription:
        'Trace needs your location to record your runs.',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
