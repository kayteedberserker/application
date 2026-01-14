import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
const { width } = Dimensions.get('window');

export default function TermsAndConditions() {
  const router = useRouter();

  const Section = ({ title, content }) => (
    <View className="mb-10">
      <View className="flex-row items-center mb-4">
        <View className="h-[2px] w-4 bg-blue-600 mr-3" />
        <Text className="text-sm font-black uppercase italic text-white tracking-widest">
          {title}
        </Text>
      </View>
      <Text className="text-gray-500 leading-7 text-[14px] font-medium px-1">
        {content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -50, left: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 50, right: -100, width: 350, height: 350, borderRadius: 175, backgroundColor: THEME.glowIndigo }} />

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* --- Header --- */}
        <View className="flex-row items-center mt-8 mb-8">
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
            className="w-12 h-12 items-center justify-center rounded-2xl border-2"
          >
            <Ionicons name="chevron-back" size={24} color={THEME.accent} />
          </TouchableOpacity>
          <View className="ml-5">
            <Text className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">Service Protocol</Text>
            <Text className="text-3xl font-black italic uppercase text-white">Terms of Use</Text>
          </View>
        </View>

        {/* --- Introduction --- */}
        <View className="mb-12">
          <Text className="text-gray-400 leading-7 text-[15px] font-medium">
            Welcome to <Text className="font-black italic text-white uppercase">Oreblogda</Text>. 
            By initializing this application, you agree to the following operational directives. 
            We have simplified the syntax for maximum clarity.
          </Text>
        </View>

        {/* --- Terms Sections --- */}
        <Section 
          title="01. Content Ownership"
          content="All transmissions, articles, and media on Oreblogda are for informational purposes. You are authorized to access and share our content, but reproduction or unauthorized deployment of our original work without proper credit is a violation of protocol."
        />

        <Section 
          title="02. User Conduct"
          content="We maintain a high-integrity, positive environment. Spam, hostile conduct, or harmful behavior will not be tolerated. Violation of these directives results in an immediate purge of comments or permanent revocation of author credentials."
        />

        <Section 
          title="03. External Relays"
          content="The grid may contain links to external anime nodes, merchants, or news feeds. We do not control these third-party sectors and are not responsible for their data practices. Initiate external uplinks at your own risk."
        />

        <Section 
          title="04. System Updates"
          content="Oreblogda is constantly evolving. We reserve the right to modify these terms to reflect new system features or policy adjustments. The most recent version is always available in this directory."
        />

        {/* --- Support Callout --- */}
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="mt-6 p-10 rounded-[45px] border-2 items-center"
        >
          <View 
            style={{ backgroundColor: THEME.bg, borderColor: THEME.border }}
            className="w-14 h-14 rounded-2xl items-center justify-center mb-6 border-2 shadow-sm"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={THEME.accent} />
          </View>
          <Text className="text-white font-black italic uppercase text-lg mb-3 text-center">
            Uplink Support
          </Text>
          <Text className="text-gray-500 text-center text-sm leading-6 font-medium mb-6">
            If you require clarification on these terms or community directives, contact our support node:
          </Text>
          <TouchableOpacity 
            className="bg-blue-600/10 px-6 py-3 rounded-full border border-blue-600/30"
          >
            <Text className="font-black text-blue-500 uppercase tracking-widest text-sm">
              oreblogda@gmail.com
            </Text>
          </TouchableOpacity>
        </View>

        <View className="items-center mt-16 mb-10">
           <Text className="text-gray-800 font-black text-[8px] uppercase tracking-[0.5em]">
             © 2026 OREBLOGDA MEDIA // ALL RIGHTS RESERVED
           </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
