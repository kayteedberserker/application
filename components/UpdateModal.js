import { Feather, Ionicons } from "@expo/vector-icons";
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, Text as RNText, useColorScheme, View } from 'react-native';

// 1. Version Config
const LATEST_VERSION = '1.5.0'; 
// Use expoConfig for modern Expo apps, fallback to manifest for older ones
const INSTALLED_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

const isUpdateRequired = (installed, latest) => {
  const parse = v => v.split('.').map(n => parseInt(n, 10));
  const [iMajor, iMinor, iPatch] = parse(installed);
  const [lMajor, lMinor, lPatch] = parse(latest);

  if (iMajor < lMajor) return true;
  if (iMajor === lMajor && iMinor < lMinor) return true;
  if (iMajor === lMajor && iMinor === lMinor && iPatch < lPatch) return true;
  return false;
};

export default function UpdateHandler() {
  const [visible, setVisible] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (isUpdateRequired(INSTALLED_VERSION, LATEST_VERSION)) {
      // Small delay so it doesn't pop up the split second the app opens
      setTimeout(() => setVisible(true), 1500);
    }
  }, []);

  const handleUpdate = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.kaytee.oreblogda');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/80 px-6">
        
        {/* GAMING UI CONTAINER */}
        <View 
          style={{ 
            borderWidth: 2, 
            borderColor: '#2563eb',
            shadowColor: "#3b82f6",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 15,
          }}
          className={`${isDark ? "bg-[#0d1117]" : "bg-white"} w-full rounded-[32px] overflow-hidden`}
        >
          {/* TOP SCANNER LINE ANIMATION EFFECT */}
          <View className="h-[4px] w-full bg-blue-600 opacity-50" />
          
          <View className="p-8 items-center">
            {/* ICON HUD */}
            <View className="w-16 h-16 bg-blue-600/10 rounded-full items-center justify-center mb-6 border border-blue-500/20">
              <Feather name="download-cloud" size={32} color="#2563eb" />
            </View>

            {/* TEXT SECTION */}
            <RNText className={`text-center font-[900] uppercase italic tracking-tighter text-2xl mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              System Upgrade Available
            </RNText>
            
            <RNText className="text-center text-[10px] text-blue-500 font-black uppercase tracking-[3px] mb-4">
              Version v{LATEST_VERSION} Detected
            </RNText>

            <RNText className="text-center text-sm leading-6 text-gray-500 dark:text-gray-400 mb-8 px-2">
              A critical transmission patch is ready. Deploy the latest version to maintain optimal connection to the network.
            </RNText>

            {/* ACTION BUTTONS */}
            <View className="w-full gap-3">
              <Pressable 
                onPress={handleUpdate}
                style={{ elevation: 5 }}
                className="bg-blue-600 py-4 rounded-2xl flex-row justify-center items-center"
              >
                <Ionicons name="rocket-sharp" size={18} color="white" className="mr-2" />
                <RNText className="text-white font-black uppercase tracking-widest ml-2">Deploy Update</RNText>
              </Pressable>

              <Pressable 
                onPress={() => setVisible(false)}
                className="py-4 rounded-2xl border border-gray-200 dark:border-gray-800"
              >
                <RNText className="text-center text-gray-500 font-bold uppercase tracking-tighter text-xs">
                  Ignore Transmission
                </RNText>
              </Pressable>
            </View>
          </View>

          {/* BOTTOM DECOR */}
          <View className="h-[2px] w-full bg-blue-600 opacity-10" />
        </View>

        {/* HUD VERSION INFO */}
        <RNText className="text-[9px] text-gray-500 mt-4 uppercase tracking-[5px]">
          Installed: v{INSTALLED_VERSION} | Status: Outdated
        </RNText>
      </View>
    </Modal>
  );
}
