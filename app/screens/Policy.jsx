import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, ScrollView, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
import TopBar from '../../components/Topbar';
const { width } = Dimensions.get('window');

export default function PrivacyPolicy() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const Section = ({ title, content }) => (
    <View className="mb-10">
      <View className="flex-row items-center mb-4">
        <View style={{ backgroundColor: THEME.accent }} className="h-[2px] w-4 mr-3" />
        <Text style={{ color: THEME.text }} className="text-sm font-black uppercase italic tracking-widest">
          {title}
        </Text>
      </View>
      <Text style={{ color: THEME.textSecondary || '#64748b' }} className="leading-7 text-[14px] font-medium px-1">
        {content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <TopBar isDark={isDark}/>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -100, right: -50, width: 350, height: 350, borderRadius: 175, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 0, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowIndigo }} />

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
            <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Legal Protocol</Text>
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">Privacy Policy</Text>
          </View>
        </View>

        {/* --- Status Badge --- */}
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="self-start px-5 py-2 rounded-xl mb-10 border-2"
        >
          <Text style={{ color: THEME.accent }} className="text-[9px] font-black uppercase tracking-[0.2em]">
            Last Sync: October 2025 // Secure
          </Text>
        </View>

        <Text style={{ color: THEME.textSecondary || '#94a3b8' }} className="mb-12 leading-7 text-[15px] font-medium">
          Welcome to <Text style={{ color: THEME.text }} className="font-black italic uppercase">Oreblogda</Text>. 
          Your privacy is a core directive. This protocol explains how we collect, process, and encrypt your 
          data within our mobile ecosystem.
        </Text>

        {/* --- Policy Sections --- */}
        <Section 
          title="01. Data Acquisition"
          content="We may collect personal identity tags such as your email address when you initialize an author profile. Non-personal metadata is captured automatically via analytics to optimize the user interface."
        />

        <Section 
          title="02. Information Processing"
          content="• Deployment of updates regarding new transmissions.&#10;• Optimization of app sub-systems and reader analysis.&#10;• Maintaining the integrity and security of the platform grid."
        />

        <Section 
          title="03. Tracking Protocols"
          content="We utilize local storage and data cookies to personalize your uplink and analyze traffic. These can be modified in your device configuration, though it may limit core app functionality."
        />

        <Section 
          title="04. Third-Party Uplinks"
          content="We do not sell or distribute your personal data arrays to external syndicates, except as required by law or to maintain the safety of the Oreblogda network."
        />

        <Section 
          title="05. Encryption & Safety"
          content="We implement robust security measures to shield your data. However, as no digital transmission is entirely impenetrable, absolute security cannot be fully guaranteed."
        />

        <Section 
          title="06. Identity Rights"
          content="You retain the right to modify or purge your data arrays from our database. Termination of newsletter uplinks is available via the 'Unsubscribe' link in any transmission."
        />

        <Section 
          title="07. Protocol Evolution"
          content="We may update these Privacy Protocols periodically to reflect changes in our grid operations. The timestamp at the top indicates the latest firmware version of this policy."
        />

        {/* --- Contact Footer --- */}
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="mt-6 p-10 rounded-[45px] border-2 items-center"
        >
          <View 
            style={{ backgroundColor: THEME.accent + '15' }} 
            className="w-12 h-12 rounded-full items-center justify-center mb-4"
          >
            <Ionicons name="mail-outline" size={24} color={THEME.accent} />
          </View>
          <Text style={{ color: THEME.text }} className="font-black italic uppercase text-lg mb-3 text-center">Inquiry Channel</Text>
          <Text style={{ color: THEME.textSecondary || '#64748b' }} className="text-center text-sm leading-6 font-medium">
            For questions regarding this protocol, initiate contact at:{"\n"}
            <Text style={{ color: THEME.accent }} className="font-bold uppercase tracking-widest mt-2">oreblogda@gmail.com</Text>
          </Text>
        </View>

        <View className="items-center mt-16 mb-10">
            <View style={{ backgroundColor: THEME.border }} className="h-[1px] w-12 mb-4" />
            <Text style={{ color: THEME.textSecondary || '#334155' }} className="font-black text-[8px] uppercase tracking-[0.5em]">
                Secure Document // Auth Code: PRIV-2025
            </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
