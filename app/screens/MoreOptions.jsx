import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
const { width } = Dimensions.get('window');

export default function MoreOptions() {
  const router = useRouter();
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check current permission status on mount
  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setIsNotificationsEnabled(status === 'granted');
    // Loading animation per your requirement
    setTimeout(() => setLoading(false), 800);
  };

  const toggleNotifications = async () => {
    setLoading(true);
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'denied' && !isNotificationsEnabled) {
      Alert.alert(
        "Permissions Required",
        "Notifications are disabled in your system settings. Would you like to enable them now?",
        [
          { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
          { text: "Open Settings", onPress: () => {
              setLoading(false);
              Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings();
            } 
          }
        ]
      );
      return;
    }

    if (!isNotificationsEnabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      setIsNotificationsEnabled(status === 'granted');
    } else {
      Alert.alert(
        "Disable Notifications",
        "To fully stop notifications, please disable them in your device system settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() }
        ]
      );
    }
    setLoading(false);
  };

  const MenuRow = ({ title, icon, route, color = "#2563eb" }) => (
    <TouchableOpacity 
      onPress={() => DeviceEventEmitter.emit("navigateSafely", route)}
      activeOpacity={0.8}
      style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
      className="flex-row items-center p-5 mb-3 rounded-2xl border-2"
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={{color: THEME.text}} className='flex-1 ml-4 text-sm font-black uppercase italic tracking-tight'>{title}</Text>
      <Ionicons name="chevron-forward" size={16} color={THEME.border} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -50, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue, opacity: 0.2 }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowPurple, opacity: 0.2 }} />

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        
        {/* --- Header --- */}
        <View className="flex-row items-center mt-8 mb-10">
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
            className="w-12 h-12 items-center justify-center rounded-2xl border-2"
          >
            <Ionicons name="chevron-back" size={24} color={THEME.accent} />
          </TouchableOpacity>
          <View className="ml-5">
            <Text className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">System Core</Text>
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">Directory</Text>
          </View>
        </View>

        {/* --- Section: Settings --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">
          Internal Configuration
        </Text>
        <View 
            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
            className="flex-row items-center p-5 mb-8 rounded-2xl border-2"
        >
          <View className="w-10 h-10 rounded-xl items-center justify-center bg-blue-500/10">
            <Ionicons name="notifications-outline" size={20} color={THEME.accent} />
          </View>
          <View className="flex-1 ml-4">
            <Text style={{color: THEME.text}} className="text-sm font-black italic uppercase">Push Notifications</Text>
            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                Status: {isNotificationsEnabled ? "Active Uplink" : "Signal Blocked"}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={THEME.accent} />
          ) : (
            <Switch
              trackColor={{ false: "#1e293b", true: THEME.accent }}
              thumbColor={"#fff"}
              onValueChange={toggleNotifications}
              value={isNotificationsEnabled}
            />
          )}
        </View>

        {/* --- Section: Social & Rewards (NEW) --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">
          Social & Rewards
        </Text>
        <MenuRow 
            title="Affiliate Uplink (Referrals)" 
            icon="gift-outline" 
            route="/screens/Referral" 
            color="#a855f7" 
        />
        <MenuRow 
            title="Clan Intelligence" 
            icon="shield-outline" 
            route="/screens/ClanInfoScreen" 
            color="#ec4899" 
        />

        <View className="h-6" />

        {/* --- Section: Progression --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">
          Author Progression
        </Text>
        <MenuRow 
            title="Rank, Streak & AURA System" 
            icon="flash-outline" 
            route="/screens/RankSystemScreen" 
            color="#f97316" 
        />

        <View className="h-6" />

        {/* --- Section 1: Writing Guidelines --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">
          Knowledge Base
        </Text>
        <MenuRow 
            title="Formatting Protocols" 
            icon="code-working" 
            route="/screens/Instructions" 
            color="#3b82f6" 
        />
        <MenuRow 
            title="Validation Rules" 
            icon="shield-checkmark-outline" 
            route="/screens/Rules" 
            color="#10b981" 
        />

        <View className="h-6" />

        {/* --- Section 2: Support --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">
          Communication Links
        </Text>
        <MenuRow 
            title="Platform Intelligence" 
            icon="bulb-outline" 
            route="/screens/About" 
            color="#8b5cf6" 
        />
        <MenuRow 
            title="Technical Support" 
            icon="terminal-outline" 
            route="/screens/Contact" 
            color="#f59e0b" 
        />

        <View className="h-6" />

        {/* --- Section 3: Legal --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">
          Encryption & Legal
        </Text>
        <MenuRow 
            title="Terms of Service" 
            icon="document-attach-outline" 
            route="/screens/Terms" 
            color="#64748b" 
        />
        <MenuRow 
            title="Privacy Protocols" 
            icon="finger-print-outline" 
            route="/screens/Policy" 
            color="#64748b" 
        />

        {/* --- Footer Info --- */}
        <View className="items-center mt-16 mb-12">
          <View className="bg-gray-900 px-4 py-2 rounded-full border border-gray-800 mb-2">
            <Text style={{color: "white"}} className="text-gray-500 font-mono text-[9px] uppercase tracking-widest">
                Firmware: v1.0.5-STABLE
            </Text>
          </View>
          <Text className="text-gray-700 text-[10px] font-black uppercase italic tracking-tighter">
            Terminal optimized for Author use
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}