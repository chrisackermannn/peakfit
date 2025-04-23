import 'dotenv/config';

export default {
  expo: {
    name: "PeakFit",
    slug: "PeakFit",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    scheme: "peakfit",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.PeakFit",
      googleServicesFile: "./GoogleService-Info.plist",
      config: {
        googleSignIn: {
          reservedClientId: process.env.GOOGLE_RESERVED_CLIENT_ID
        }
      },
      infoPlist: {
        NSHealthShareUsageDescription: "This app requires access to your health data to track and display workout metrics",
        NSHealthUpdateUsageDescription: "This app requires permission to write workout data to your Health app"
      }
    },
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.access": ["health-data"]
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.anonymous.PeakFit",
      googleServicesFile: "google-services.json"
    },
    web: {
      favicon: "./assets/favicon.png",
      config: {
        google: {
          clientId: process.env.GOOGLE_WEB_CLIENT_ID
        }
      }
    },
    plugins: [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow PeakFit to access your photos to update your profile picture.",
          "cameraPermission": "Allow PeakFit to access your camera to take profile pictures."
        }
      ]
    ],
    extra: {
      // Firebase config
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseStorageUrl: process.env.FIREBASE_STORAGE_URL,
      
      // Google auth
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      googleExpoClientId: process.env.GOOGLE_EXPO_CLIENT_ID,
      googleReservedClientId: process.env.GOOGLE_RESERVED_CLIENT_ID,
      
      // RapidAPI
      rapidApiKey: process.env.RAPIDAPI_KEY,
      rapidApiHost: process.env.RAPIDAPI_HOST,

      eas: {
        projectId: "your-project-id"
      },
      googleAuth: {
        redirectUris: [
          "exp://192.168.1.164:8081/--/auth",
          "https://auth.expo.io/@your-actual-expo-username/PeakFit",
          "exp://localhost:19000/--/auth",
          "peakfit://auth",
          process.env.GOOGLE_RESERVED_CLIENT_ID + "://"
        ]
      }
    },
  }
};