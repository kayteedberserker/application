import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
const { width } = Dimensions.get('window');


export default function AboutScreen() {
  const router = useRouter();

  const MissionCard = ({ icon, title, text }) => (
    <View 
      style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
      className="p-6 rounded-[32px] mb-4 border-2 shadow-sm"
    >
      <View className="flex-row items-center mb-3">
        <View className="w-8 h-8 rounded-lg bg-blue-600/10 items-center justify-center border border-blue-600/20">
            <Ionicons name={icon} size={18} color={THEME.accent} />
        </View>
        <Text className="ml-3 font-black uppercase italic text-white tracking-tight">{title}</Text>
      </View>
      <Text className="text-gray-500 text-sm leading-6 font-medium">
        {text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
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
            <Text className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">Information Protocol</Text>
            <Text className="text-3xl font-black italic uppercase text-white">About Us</Text>
          </View>
        </View>

        {/* --- Hero Section --- */}
        <View className="items-center mb-12">
          <View 
            style={{ borderColor: THEME.accent }}
            className="w-24 h-24 bg-gray-900 rounded-[35px] items-center justify-center mb-6 border-2 shadow-2xl shadow-blue-500/20"
          >
             <Text className="text-5xl">🎌</Text>
          </View>
          <Text className="text-4xl font-black italic uppercase text-white tracking-tighter">
            Oreblogda
          </Text>
          <View className="bg-blue-600/10 px-4 py-1 rounded-full border border-blue-600/20 mt-2">
            <Text className="text-blue-500 font-black uppercase text-[10px] tracking-widest">
                The Prime Anime Uplink
            </Text>
          </View>
        </View>

        {/* --- Introduction --- */}
        <View className="mb-12 px-2">
          <Text className="text-base text-gray-400 text-center leading-7 font-medium">
            Accessing <Text className="font-black italic text-white uppercase">Oreblogda</Text> — 
            your primary encrypted hub for everything anime, manga, and otaku culture. 
            We are the signal in the static.
          </Text>
        </View>

        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">Core Modules</Text>

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
          <Text className="text-white text-center font-black italic uppercase text-xl mb-3">
            Snack-Time Protocol
          </Text>
          <Text className="text-gray-500 text-center leading-6 text-sm font-medium">
            Power up your Wi-Fi and join the syndicate. Stay tuned, stay hyped, and <Text className="text-blue-500 font-black">NEVER SKIP THE OPENING SONG.</Text>
          </Text>
        </View>

        <View className="items-center mt-16 mb-10">
            <View className="h-[1px] w-12 bg-gray-800 mb-4" />
            <Text className="text-gray-700 font-black uppercase text-[9px] tracking-[0.3em]">
                Built by Fans // For Fans
            </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
