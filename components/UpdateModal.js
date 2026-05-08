import { Feather, Ionicons } from "@expo/vector-icons";
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { useMMKV } from 'react-native-mmkv';
import apiFetch from "../utils/apiFetch";

import { Linking, Modal, Pressable, Text as RNText, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const VERSION_CHECK_URL = '/version';
const INSTALLED_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
const INSTALLED_RUNTIME = Updates.runtimeVersion || 'v1';
const SNOOZE_KEY = 'OREBLOGDA_UPDATE_SNOOZE';
const SNOOZE_DURATION = 60 * 60 * 1000; // 1 Hour in milliseconds

// Helper to check standard app version
const isAppUpdateRequired = (installed, latest) => {
  if (!latest) return false;
  const installedParts = installed.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(installedParts.length, latestParts.length); i++) {
    const v1 = installedParts[i] || 0;
    const v2 = latestParts[i] || 0;
    if (v2 > v1) return true;
    if (v2 < v1) return false;
  }
  return false;
};

// Helper to check runtime version
const isRuntimeUpdateRequired = (installed, latest) => {

  if (!latest) return false;
  const getVersionNumber = (verStr) => {
    const match = String(verStr).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  return getVersionNumber(latest) > getVersionNumber(installed);
};

export default function UpdateHandler() {
  const [visible, setVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isCritical, setIsCritical] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [canIgnore, setCanIgnore] = useState(true);

  // Correct MMKV Hook usage
  const storage = useMMKV();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    fetchLatestVersion();
  }, []);

  useEffect(() => {
    if (visible) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [visible]);

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseAnim.value }]
    };
  });

  useEffect(() => {
    let timer;
    if (visible && isCritical && countdown > 0) {
      setCanIgnore(false);
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanIgnore(true);
    }
    return () => clearInterval(timer);
  }, [visible, isCritical, countdown]);

  const fetchLatestVersion = async () => {
    try {
      const response = await apiFetch(VERSION_CHECK_URL);
      const data = await response.json();

      if (data.appVersion && data.runtimeVersion) {
        setLatestVersion(data.appVersion);

        const runtimeNeedsUpdate = isRuntimeUpdateRequired(INSTALLED_RUNTIME, data.runtimeVersion);
        const appNeedsUpdate = isAppUpdateRequired(INSTALLED_VERSION, data.appVersion);

        const criticalStatus = runtimeNeedsUpdate || data.critical;
        setIsCritical(criticalStatus);

        if (runtimeNeedsUpdate || appNeedsUpdate) {
          if (criticalStatus) {
            setVisible(true);
          } else {
            // Background check: only show if snooze expired
            const lastSnooze = storage.getNumber(SNOOZE_KEY);
            const now = Date.now();

            if (!lastSnooze || now - lastSnooze > SNOOZE_DURATION) {
              setVisible(true);
            }
          }
        }
      }
    } catch (error) {
      console.error("Version check failed", error);
    }
  };

  const handleUpdate = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.kaytee.oreblogda');
  };

  const handleSkip = () => {
    if (!canIgnore) return;

    if (!isCritical) {
      storage.set(SNOOZE_KEY, Date.now());
    }

    setVisible(false);
  };

  // If not visible, return null so it occupies NO space in your layout
  if (!visible) return null;

  const themeColor = isCritical ? "#ef4444" : "#2563eb";
  const shadowColor = isCritical ? "#ff0000" : "#3b82f6";
  if (__DEV__) {
    return null
  }
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className={`flex-1 justify-center items-center px-6 ${isCritical ? 'bg-red-950/90' : 'bg-black/80'}`}>

        <View
          style={{
            borderWidth: 2,
            borderColor: themeColor,
            shadowColor: shadowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 20,
          }}
          className={`${isDark ? "bg-[#0d1117]" : "bg-white"} w-full rounded-[32px] overflow-hidden`}
        >
          <View style={{ backgroundColor: themeColor }} className="h-[4px] w-full opacity-50" />

          <View className="p-8 items-center">
            <Animated.View
              style={[
                {
                  backgroundColor: `${themeColor}20`,
                  borderColor: `${themeColor}40`
                },
                pulseAnimatedStyle
              ]}
              className="w-16 h-16 rounded-full items-center justify-center mb-6 border"
            >
              <Feather name={isCritical ? "alert-triangle" : "download-cloud"} size={32} color={themeColor} />
            </Animated.View>

            <RNText className={`text-center font-[900] uppercase italic tracking-tighter text-2xl mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              {isCritical ? "Security Breach" : "System Upgrade"}
            </RNText>

            <RNText style={{ color: themeColor }} className="text-center text-[10px] font-black uppercase tracking-[3px] mb-4">
              {isCritical ? "PROTOCOL_ALPHA_REQUIRED" : `v${latestVersion} Available`}
            </RNText>

            <RNText className="text-center text-sm leading-6 text-gray-500 dark:text-gray-400 mb-8 px-2">
              {isCritical
                ? "Emergency patches detected. Current build is unstable. System synchronization required to prevent data loss."
                : "A new transmission patch is ready. Deploy the latest version to maintain optimal connection."}
            </RNText>

            <View className="w-full gap-3">
              <Animated.View style={pulseAnimatedStyle}>
                <Pressable
                  onPress={handleUpdate}
                  style={{
                    elevation: 10,
                    backgroundColor: themeColor,
                    shadowColor: themeColor,
                    shadowRadius: 10,
                    shadowOpacity: 0.5
                  }}
                  className="py-4 rounded-2xl flex-row justify-center items-center"
                >
                  <Ionicons name={isCritical ? "shield-checkmark" : "rocket-sharp"} size={18} color="white" />
                  <RNText className="text-white font-black uppercase tracking-widest ml-2">Fix System Now</RNText>
                </Pressable>
              </Animated.View>

              <Pressable
                onPress={handleSkip}
                disabled={!canIgnore}
                style={{ opacity: canIgnore ? 1 : 0.3 }}
                className="py-4 rounded-2xl border border-gray-200 dark:border-gray-800"
              >
                <RNText className="text-center text-gray-500 font-bold uppercase tracking-tighter text-xs">
                  {canIgnore ? "Skip for now" : `Overriding lock... ${countdown}s`}
                </RNText>
              </Pressable>
            </View>
          </View>

          <View style={{ backgroundColor: themeColor }} className="h-[2px] w-full opacity-10" />
        </View>

        <RNText style={{ color: isCritical ? '#ef4444' : '#6b7280' }} className="text-[9px] mt-4 uppercase tracking-[5px] font-bold text-center">
          {isCritical ? "SYSTEM_STATUS: COMPROMISED\n" : ""}
          CORE: {INSTALLED_VERSION} | RUNTIME: {INSTALLED_RUNTIME}
        </RNText>
      </View>
    </Modal>
  );
}