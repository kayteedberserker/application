import { Feather, Ionicons } from "@expo/vector-icons";
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import apiFetch from "../utils/apiFetch";

import { Animated, Easing, Linking, Modal, Pressable, Text as RNText, useColorScheme, View } from 'react-native';

const VERSION_CHECK_URL = 'https://oreblogda.com/api/version'; 
const INSTALLED_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

const isUpdateRequired = (installed, latest) => {
  return null
};

export default function UpdateHandler() {
  const [visible, setVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isCritical, setIsCritical] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [canIgnore, setCanIgnore] = useState(true);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Pulse Animation Ref
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchLatestVersion();
  }, []);

  // Animation Trigger
  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  // Countdown logic
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
      if (data.version) {
        setLatestVersion(data.version);
        setIsCritical(data.critical);
        if (isUpdateRequired(INSTALLED_VERSION, data.version)) {
          setVisible(true);
        }
      }
    } catch (error) {
      console.error("Version check failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.kaytee.oreblogda');
  };

  if (isLoading && !visible) return null;

  const themeColor = isCritical ? "#ef4444" : "#2563eb";
  const shadowColor = isCritical ? "#ff0000" : "#3b82f6";

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
            {/* PULSING ICON */}
            <Animated.View 
                style={{ 
                    backgroundColor: `${themeColor}20`, 
                    borderColor: `${themeColor}40`,
                    transform: [{ scale: pulseAnim }]
                }}
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
              {/* PULSING ACTION BUTTON */}
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
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
                onPress={() => canIgnore && setVisible(false)}
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

        <RNText style={{ color: isCritical ? '#ef4444' : '#6b7280' }} className="text-[9px] mt-4 uppercase tracking-[5px] font-bold">
          {isCritical ? "SYSTEM_STATUS: COMPROMISED" : `CORE_VERSION: ${INSTALLED_VERSION}`}
        </RNText>
      </View>
    </Modal>
  );
}
