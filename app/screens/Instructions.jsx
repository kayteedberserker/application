import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import THEME from '../../components/useAppTheme';
const { width } = Dimensions.get('window');


export default function Instructions() {
  const router = useRouter();

  const InstructionStep = ({ icon, title, desc, color }) => (
    <View className="flex-row items-start mb-8">
      <View 
        style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }} 
        className="w-12 h-12 rounded-2xl items-center justify-center border"
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View className="flex-1 ml-5">
        <Text style={{ color: THEME.text }} className="text-sm font-black uppercase italic tracking-tight">{title}</Text>
        <Text style={{ color: THEME.textSecondary || '#64748b' }} className="mt-1.5 leading-5 font-medium text-[13px]">{desc}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* --- Ambient Background Glows --- */}
      <View style={{ position: 'absolute', top: -50, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.glowBlue }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.glowGreen }} />

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
            <Text style={{ color: THEME.accent }} className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Knowledge Base</Text>
            <Text style={{ color: THEME.text }} className="text-3xl font-black italic uppercase">How to Post</Text>
          </View>
        </View>

        {/* --- 1. The Core Workflow --- */}
        <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-6 ml-1">Transmission Basics</Text>
        
        <InstructionStep 
          icon="text-outline"
          title="Smart Formatting"
          desc="The new engine supports shorthand tags like h() for headers. Simply highlight any text to reveal the quick-format toolbar for instant tagging."
          color="#3b82f6"
        />

        <InstructionStep 
          icon="scan-outline"
          title="Pre-Flight Check"
          desc="Always tap 'Show Preview'. This verifies the visual output. The system now automatically cleans trailing spaces inside your tags."
          color="#8b5cf6"
        />

        {/* --- 2. Media & Social --- */}
        <View style={{ backgroundColor: THEME.border, height: 1 }} className="my-6 opacity-30" />
        <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-6 ml-1">Media Integration</Text>
        
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="p-6 rounded-[32px] border-2 mb-8"
        >
          <View className="flex-row items-center mb-4">
            <View className="flex-row">
              <Ionicons name="logo-tiktok" size={18} color={THEME.accent} />
              <View className="mx-2" />
              <Ionicons name="logo-youtube" size={18} color="#ef4444" />
            </View>
            <Text style={{ color: THEME.text }} className="ml-3 font-black italic uppercase">Video Embeds</Text>
          </View>
          <Text style={{ color: THEME.textSecondary || '#94a3b8' }} className="text-sm leading-6 font-medium">
            Paste full URLs from TikTok or YouTube. Shortened 'vm' or 'youtu.be' links are supported, but full desktop URLs provide the fastest loading sequence for readers.
          </Text>
        </View>

        {/* --- 3. Interaction --- */}
        <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px] tracking-[0.2em] mb-6 ml-1">User Engagement</Text>
        
        <InstructionStep 
          icon="bar-chart-outline"
          title="Interactive Data"
          desc="Toggle 'Add a Poll' for crowd feedback. Minimum 2 options required. Data shows 3x higher engagement on interactive posts."
          color="#10b981"
        />

        {/* --- 4. Formatting Guide Table --- */}
        <View 
          style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
          className="p-6 rounded-[32px] mt-4 border-2 shadow-2xl shadow-blue-500/10"
        >
          <View className="flex-row items-center mb-6">
             <Ionicons name="code-slash" size={18} color={THEME.accent} />
             <Text style={{ color: THEME.text }} className="ml-3 font-black italic uppercase">v3.0 Syntax Reference</Text>
          </View>
          
          <View className="space-y-4">
            <View 
               style={{ borderBottomColor: THEME.border }}
               className="flex-row justify-between border-b pb-3 mb-3"
            >
              <Text style={{ color: THEME.accent }} className="font-mono text-[11px] font-bold">h(TITLE)</Text>
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px]">Bold Header</Text>
            </View>

            <View 
               style={{ borderBottomColor: THEME.border }}
               className="flex-row justify-between border-b pb-3 mb-3"
            >
              <Text style={{ color: THEME.accent }} className="font-mono text-[11px] font-bold">s(CONTENT)</Text>
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px]">Styled Section</Text>
            </View>

            <View 
               style={{ borderBottomColor: THEME.border }}
               className="flex-row justify-between border-b pb-3 mb-3"
            >
              <Text style={{ color: THEME.accent }} className="font-mono text-[11px] font-bold">l(ITEM)</Text>
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px]">Bullet Node</Text>
            </View>

            <View 
               style={{ borderBottomColor: THEME.border }}
               className="flex-row justify-between border-b pb-3 mb-3"
            >
              <Text style={{ color: THEME.accent }} className="font-mono text-[11px] font-bold">br()</Text>
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px]">Line Break</Text>
            </View>

            <View className="flex-row justify-between pb-1">
              <Text style={{ color: THEME.accent }} className="font-mono text-[10px] font-bold">link(URL)-text(LABEL)</Text>
              <Text style={{ color: THEME.textSecondary || '#475569' }} className="font-black uppercase text-[9px]">Source Link</Text>
            </View>
          </View>
        </View>

        <View className="items-center mt-12 mb-8">
            <Text style={{ color: THEME.textSecondary || '#334155' }} className="font-black text-[8px] uppercase tracking-[0.4em]">Formatting Engine v3.0 (Hybrid Support)</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
        }
