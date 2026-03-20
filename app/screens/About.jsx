import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, ScrollView, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
import TopBar from '../../components/Topbar';
const { width } = Dimensions.get('window');

export default function AboutScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const MissionCard = ({ icon, title, text }) => (
    <View 
      style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
      className="p-6 rounded-[32px] mb-4 border-2 shadow-sm"
    >
      <View className="flex-row items-center mb-3">
        <View 
          style={{ backgroundColor: THEME.accent + '15', borderColor: THEME.accent + '30' }}
          className="w-8 h-8 rounded-lg items-center justify-center border"
        >
            <Ionicons name={icon} size={18} color={THEME.accent} />
        </View>
        <Text style={{ color: THEME.text }} className="ml-3 font-black uppercase italic tracking-tight">{title}</Text>
      </View>
      <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-sm leading-6 font-medium">
        {text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <TopBar isDark={isDark}/>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -100, left: -50, width: 350, height: 350, borderRadius: 175, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 0, right: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowIndigo }} />

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 60 }}>
        
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
            <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Information Protocol</Text>
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">About Us</Text>
          </View>
        </View>

        {/* --- Hero Section --- */}
        <View className="items-center mb-12">
          <View 
            style={{ borderColor: THEME.accent, backgroundColor: THEME.card }}
            className="w-24 h-24 rounded-[35px] items-center justify-center mb-6 border-2 shadow-2xl"
          >
             <Text className="text-5xl">🎌</Text>
          </View>
          <Text style={{ color: THEME.text }} className="text-4xl font-black italic uppercase tracking-tighter">
            Oreblogda
          </Text>
          <View style={{ backgroundColor: THEME.accent + '15', borderColor: THEME.accent + '30' }} className="px-4 py-1 rounded-full border mt-2">
            <Text style={{ color: THEME.accent }} className="font-black uppercase text-[10px] tracking-widest">
                The Prime Anime Uplink
            </Text>
          </View>
        </View>

        {/* --- Introduction --- */}
        <View className="mb-12 px-2">
          <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-base text-center leading-7 font-medium">
            Accessing <Text style={{ color: THEME.text }} className="font-black italic uppercase">Oreblogda</Text> — 
            your primary encrypted hub for everything anime, manga, and otaku culture. 
            We are the signal in the static.
          </Text>
        </View>

        <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">Core Modules</Text>

        {/* --- Content Breakdown --- */}
        <MissionCard 
          icon="flash-outline"
          title="Live Transmission"
          text="From the latest global news and episode breakdowns to fun facts and underrated recommendations, we provide real-time updates."
        />

        <MissionCard 
          icon="people-outline"
          title="Global Syndicate"
          text="Whether you’re deep into shōnen battles, slice-of-life stories, or here for the memes — this is your designated sector."
        />

        <MissionCard 
          icon="terminal-outline"
          title="Fan-Driven Intelligence"
          text="We’re fans first — writers second. Our directive is to make anime news fun, honest, and worth your processing power."
        />

        {/* --- Fun Footer Sign-off --- */}
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="mt-10 p-10 rounded-[45px] border-2 items-center"
        >
          <Text className="text-5xl mb-6">🍿</Text>
          <Text style={{ color: THEME.text }} className="text-center font-black italic uppercase text-xl mb-3">
            Snack-Time Protocol
          </Text>
          <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-center leading-6 text-sm font-medium">
            Power up your Wi-Fi and join the syndicate. Stay tuned, stay hyped, and <Text style={{ color: THEME.accent }} className="font-black">NEVER SKIP THE OPENING SONG.</Text>
          </Text>
        </View>

        <View className="items-center mt-16 mb-10">
            <View style={{ backgroundColor: THEME.border }} className="h-[1px] w-12 mb-4" />
            <Text style={{ color: THEME.textSecondary || '#334155' }} className="font-black uppercase text-[9px] tracking-[0.3em]">
                Built by Fans // For Fans
            </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
