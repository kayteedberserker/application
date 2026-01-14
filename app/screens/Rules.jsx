import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
const { width } = Dimensions.get('window');

export default function Rules() {
  const router = useRouter();

  const RuleItem = ({ icon, title, desc, type }) => (
    <View 
      style={{ 
        backgroundColor: THEME.card, 
        borderColor: type === 'success' ? `${THEME.success}40` : `${THEME.danger}40` 
      }}
      className="p-6 rounded-[32px] mb-4 border-2 shadow-sm"
    >
      <View className="flex-row items-center mb-3">
        <View 
          className="w-8 h-8 rounded-lg items-center justify-center border"
          style={{ 
            backgroundColor: type === 'success' ? `${THEME.success}10` : `${THEME.danger}10`,
            borderColor: type === 'success' ? `${THEME.success}30` : `${THEME.danger}30`
          }}
        >
          <Ionicons 
            name={icon} 
            size={18} 
            color={type === 'success' ? THEME.success : THEME.danger} 
          />
        </View>
        <Text 
          className="ml-3 font-black uppercase italic tracking-tight"
          style={{ color: type === 'success' ? THEME.success : THEME.danger }}
        >
          {title}
        </Text>
      </View>
      <Text className="text-gray-500 text-sm leading-6 font-medium">{desc}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -100, left: -50, width: 350, height: 350, borderRadius: 175, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowRed }} />

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
            <Text className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">Moderation Protocol</Text>
            <Text className="text-3xl font-black italic uppercase text-white">Rules & Approval</Text>
          </View>
        </View>

        <Text className="text-gray-500 font-medium mb-10 leading-6 px-1">
          THE SYSTEM reviews every uplink. Synchronize your content with these directives to ensure immediate deployment to the main feed.
        </Text>

        {/* --- ✅ BOOST APPROVAL --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">Positive Optimization</Text>
        
        <RuleItem 
          type="success"
          icon="image-outline"
          title="Visual Data Assets"
          desc="Including high-quality relevant images significantly increases approval probability. Visuals enhance the user experience across the grid."
        />

        <RuleItem 
          type="success"
          icon="code-working-outline"
          title="Rich Syntax Tags"
          desc="Effective use of [section], [h], and [li] protocols ensures data readability. Clean syntax equals faster processing."
        />

        <RuleItem 
          type="success"
          icon="language-outline"
          title="Standard: English"
          desc="While global dialects are supported, English content is prioritized for real-time decryption by the moderation core."
        />

        <View className="h-6" />

        {/* --- ❌ REJECTION TRIGGERS --- */}
        <Text className="text-gray-600 font-black uppercase text-[9px] tracking-[0.2em] mb-4 ml-1">Critical Fault Triggers</Text>

        <RuleItem 
          type="error"
          icon="scan-outline"
          title="Visual Violation"
          desc="Unrelated, blurry, or low-effort images lead to rejection. Images must synchronize with the written data payload."
        />

        <RuleItem 
          type="error"
          icon="alert-circle-outline"
          title="Restricted Content"
          desc="Adult/NSFW data is strictly prohibited. Any entry containing sexual text, images, or links will be purged immediately."
        />

        <RuleItem 
          type="error"
          icon="trash-outline"
          title="Spam / Low Bandwidth"
          desc="Entries consisting of gibberish, single words, or repetitive test sequences are flagged as spam and deleted."
        />

        <RuleItem 
          type="error"
          icon="shield-outline"
          title="Hostile Conduct"
          desc="Content attacking individuals or groups based on identity, race, or belief triggers an immediate account suspension."
        />

        <RuleItem 
          type="error"
          icon="link-outline"
          title="Corrupted Links"
          desc="Shortened URLs (bit.ly/etc) are flagged as security risks. Use direct TikTok or YouTube source links only."
        />

        {/* Final Note */}
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="mt-10 p-8 rounded-[40px] border-2 items-center"
        >
          <View className="w-12 h-12 bg-blue-500/10 rounded-full items-center justify-center mb-4">
            <Ionicons name="time-outline" size={24} color={THEME.accent} />
          </View>
          <Text className="text-center text-gray-500 text-[11px] font-black uppercase tracking-widest leading-5">
            Processing Latency: 1-6 Hours{"\n"}
            <Text className="text-gray-700">Re-Submission Lock: 12 Hours</Text>
          </Text>
        </View>

        <View className="items-center mt-12 mb-10">
            <Text className="text-gray-800 font-black text-[8px] uppercase tracking-[0.4em]">Policy Engine v4.0.1</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
