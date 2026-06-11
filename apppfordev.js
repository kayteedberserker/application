// {
//   "expo": {
//     "name": "Oreblogda - Test Build",
//     "slug": "oreblogda",
//     "version": "2.2.3",
//     "orientation": "default",
//     "icon": "./assets/images/myicon.png",
//     "scheme": "oreblogda",
//     "userInterfaceStyle": "automatic",
//     "newArchEnabled": true,
//     "owner": "oreblog",
//     "runtimeVersion": "v7_global",
//     "ios": {
//       "supportsTablet": true,
//       "bundleIdentifier": "com.kaytee.oreblogda.dev",
//       "infoPlist": {
//         "UIBackgroundModes": [
//           "remote-notification",
//           "remote-notification"
//         ],
//         "ITSAppUsesNonExemptEncryption": false
//       }
//     },
//     "android": {
//       "adaptiveIcon": {
//         "backgroundColor": "#E6F4FE",
//         "foregroundImage": "./assets/images/myicon.png",
//         "backgroundImage": "./assets/images/myicon.png"
//       },
//       "package": "com.kaytee.oreblogda.dev",
//       "googleServicesFile": "./google-services.json",
//       "predictiveBackGestureEnabled": false,
//       "permissions": [
//         "com.android.vending.BILLING",
//         "POST_NOTIFICATIONS"
//       ],
//       "intentFilters": [
//         {
//           "action": "VIEW",
//           "autoVerify": true,
//           "data": [
//             {
//               "scheme": "https",
//               "host": "oreblogda.com"
//             },
//             {
//               "scheme": "http",
//               "host": "oreblogda.com"
//             }
//           ],
//           "category": [
//             "BROWSABLE",
//             "DEFAULT"
//           ]
//         },
//         {
//           "action": "VIEW",
//           "data": [
//             {
//               "scheme": "oreblogda"
//             }
//           ],
//           "category": [
//             "BROWSABLE",
//             "DEFAULT"
//           ]
//         }
//       ]
//     },
//     "web": {
//       "output": "static",
//       "favicon": "./assets/images/myicon.png"
//     },
//     "plugins": [
//       "expo-router",
//       [
//         "expo-splash-screen",
//         {
//           "image": "./assets/images/myicon.png",
//           "imageWidth": 200,
//           "resizeMode": "contain",
//           "backgroundColor": "#ffffff",
//           "dark": {
//             "image": "./assets/images/myicon.png",
//             "backgroundColor": "#050505"
//           }
//         }
//       ],
//       "expo-secure-store",
//       [
//         "expo-build-properties",
//         {
//           "android": {
//             "minSdkVersion": 25,
//             "launchMode": "singleTop",
//             "enableProguardInReleaseBuilds": true,
//             "enableMinifyInReleaseBuilds": false,
//             "networkSecurityConfig": "./network_security_config.xml"
//           }
//         }
//       ],
//       "expo-video",
//       "expo-font",
//       "expo-image",
//       "expo-sharing",
//       "expo-web-browser",
//       [
//         "expo-notifications",
//         {
//           "icon": "./assets/images/notification.png",
//           "color": "#E6F4FE",
//           "sounds": []
//         }
//       ]
//     ],
//     "experiments": {
//       "typedRoutes": true
//     },
//     "updates": {
//       "url": "https://u.expo.dev/b22841d4-0736-4aa0-89d2-d9a48af0defc",
//       "enableBsdiffPatchSupport": true,
//       "enabled": true,
//       "checkAutomatically": "ON_LOAD",
//       "fallbackToCacheTimeout": 0
//     },
//     "extra": {
//       "router": {},
//       "eas": {
//         "projectId": "b22841d4-0736-4aa0-89d2-d9a48af0defc"
//       }
//     }
//   }
// }



// // And google service
// {
//   "project_info": {
//     "project_number": "1028280177256",
//       "project_id": "oreblogda-dev",
//         "storage_bucket": "oreblogda-dev.firebasestorage.app"
//   },
//   "client": [
//     {
//       "client_info": {
//         "mobilesdk_app_id": "1:1028280177256:android:01af1c3ad0492eb92fe1dd",
//         "android_client_info": {
//           "package_name": "com.kaytee.oreblogda.dev"
//         }
//       },
//       "oauth_client": [],
//       "api_key": [
//         {
//           "current_key": "AIzaSyBp45thUkz3r1BbZVXxrKVjjrdV8mN6XHk"
//         }
//       ],
//       "services": {
//         "appinvite_service": {
//           "other_platform_oauth_client": []
//         }
//       }
//     }
//   ],
//     "configuration_version": "1"
// }

//For real production builds, we will switch to the main branch and remove the .dev suffixes from package names and bundle identifiers. This file serves as a staging ground for testing new features and ensuring stability before merging into the main production branch.
// {
//   "project_info": {
//     "project_number": "991926389832",
//     "project_id": "ore-blogda",
//     "storage_bucket": "ore-blogda.firebasestorage.app"
//   },
//   "client": [
//     {
//       "client_info": {
//         "mobilesdk_app_id": "1:991926389832:android:f9ec7434b42ddd0e5e1c7d",
//         "android_client_info": {
//           "package_name": "com.kaytee.oreblogda"
//         }
//       },
//       "oauth_client": [],
//       "api_key": [
//         {
//           "current_key": "AIzaSyDO1ua2s39pioctjlntNtKp6-QQvguvNac"
//         }
//       ],
//       "services": {
//         "appinvite_service": {
//           "other_platform_oauth_client": []
//         }
//       }
//     }
//   ],
//   "configuration_version": "1"
// }
App.json
// {
//   "expo": {
//     "name": "Oreblogda",
//     "slug": "oreblogda",
//     "version": "2.2.5",
//     "orientation": "default",
//     "icon": "./assets/images/myicon.png",
//     "scheme": "oreblogda",
//     "userInterfaceStyle": "automatic",
//     "newArchEnabled": true,
//     "owner": "oreblogda",
//     "runtimeVersion": "v8_global",
//     "ios": {
//       "supportsTablet": true,
//       "bundleIdentifier": "com.kaytee.oreblogda",
//       "infoPlist": {
//         "UIBackgroundModes": [
//           "remote-notification",
//           "remote-notification"
//         ],
//         "UISupportedInterfaceOrientations": [
//           "UIInterfaceOrientationPortrait",
//           "UIInterfaceOrientationLandscapeLeft",
//           "UIInterfaceOrientationLandscapeRight"
//         ],
//         "ITSAppUsesNonExemptEncryption": false
//       }
//     },
//     "android": {
//       "adaptiveIcon": {
//         "backgroundColor": "#E6F4FE",
//         "foregroundImage": "./assets/images/myicon.png",
//         "backgroundImage": "./assets/images/myicon.png"
//       },
//       "package": "com.kaytee.oreblogda",
//       "googleServicesFile": "./google-services.json",
//       "predictiveBackGestureEnabled": false,
//       "permissions": [
//         "com.android.vending.BILLING",
//         "POST_NOTIFICATIONS"
//       ],
//       "intentFilters": [
//         {
//           "action": "VIEW",
//           "autoVerify": true,
//           "data": [
//             {
//               "scheme": "https",
//               "host": "oreblogda.com"
//             },
//             {
//               "scheme": "http",
//               "host": "oreblogda.com"
//             }
//           ],
//           "category": [
//             "BROWSABLE",
//             "DEFAULT"
//           ]
//         },
//         {
//           "action": "VIEW",
//           "data": [
//             {
//               "scheme": "oreblogda"
//             }
//           ],
//           "category": [
//             "BROWSABLE",
//             "DEFAULT"
//           ]
//         }
//       ]
//     },
//     "web": {
//       "output": "static",
//       "favicon": "./assets/images/myicon.png"
//     },
//     "plugins": [
//       "expo-router",
//       [
//         "expo-splash-screen",
//         {
//           "image": "./assets/images/myicon.png",
//           "imageWidth": 200,
//           "resizeMode": "contain",
//           "backgroundColor": "#ffffff",
//           "dark": {
//             "image": "./assets/images/myicon.png",
//             "backgroundColor": "#050505"
//           }
//         }
//       ],
//       "expo-secure-store",
//       [
//         "expo-build-properties",
//         {
//           "android": {
//             "minSdkVersion": 25,
//             "launchMode": "singleTop",
//             "enableProguardInReleaseBuilds": true,
//             "enableMinifyInReleaseBuilds": true,
//             "networkSecurityConfig": "./network_security_config.xml"
//           }
//         }
//       ],
//       "expo-video",
//       "expo-font",
//       "expo-image",
//       "expo-sharing",
//       "expo-web-browser",
//       [
//         "expo-notifications",
//         {
//           "icon": "./assets/images/notification.png",
//           "color": "#E6F4FE",
//           "sounds": []
//         }
//       ],
//       "@react-native-firebase/app",
//       "@react-native-firebase/messaging"
//     ],
//     "experiments": {
//       "typedRoutes": true
//     },
//     "updates": {
//       "url": "https://u.expo.dev/b6b7afd1-028a-425e-a84e-6a2af706a736",
//       "enableBsdiffPatchSupport": true,
//       "enabled": true,
//       "checkAutomatically": "ON_LOAD",
//       "fallbackToCacheTimeout": 0
//     },
//     "extra": {
//       "router": {},
//       "eas": {
//         "projectId": "b6b7afd1-028a-425e-a84e-6a2af706a736"
//       }
//     }
//   }
// }

