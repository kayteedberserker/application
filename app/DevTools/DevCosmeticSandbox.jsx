import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// ⚡️ IMPORT ALL YOUR COMPONENTS
import PlayerCard from '@/components/PlayerCard'; 
import PlayerBackground from '@/components/PlayerBackground';
import PlayerWatermark from '@/components/PlayerWatermark';
import PlayerNameplate from '@/components/PlayerNameplate';
import BadgeIcon from '@/components/BadgeIcon';
import AuraAvatar from '@/components/AuraAvatar';
import ClanBorder from '@/components/ClanBorder';

const { width } = Dimensions.get('window');

const DEFAULT_INPUT = `{
  id: 'astral_mythic_susanoo',
  name: "Susano'o Flame",
  category: 'WATERMARK',
  rarity: 'Mythic',
  visualConfig: { 
    lottieUrl: 'https://oreblogda.com/lottie/astralfire_vfx_wm.json', 
    primaryColor: "#a855f7" 
  }
}`;

export default function DevCosmeticSandbox({ isDark = true }) {
    const [inputCode, setInputCode] = useState(DEFAULT_INPUT);
    const [injectedItem, setInjectedItem] = useState(null);
    const [error, setError] = useState(null);
    
    // ⚡️ NEW: View Mode State
    const [viewMode, setViewMode] = useState('CARD'); // 'CARD' | 'ISOLATED'

    const handleInject = () => {
        try {
            setError(null);
            const parsedData = new Function('return ' + inputCode)();
            
            if (!parsedData.category) {
                throw new Error("Missing 'category' field (e.g., WATERMARK, BORDER, GLOW).");
            }
            
            // Normalize visual config just in case
            parsedData.visualConfig = parsedData.visualConfig || parsedData.visualData || {};
            setInjectedItem(parsedData);
        } catch (err) {
            setError(err.message);
        }
    };

    const mannequinUser = useMemo(() => {
        const baseUser = {
            username: "DEV_TESTER",
            deviceId: "SYS-0000-8888",
            description: "Debugging the matrix...",
            previousRank: 1, 
            weeklyAura: 999,
            preferences: { favCharacter: "THE ARCHITECT" },
            profilePic: { url: null }, 
            inventory: []
        };

        if (injectedItem) {
            baseUser.inventory.push({
                ...injectedItem,
                itemId: injectedItem.id || 'dev_item_01',
                isEquipped: true,
            });
        }

        return baseUser;
    }, [injectedItem]);

    // ⚡️ NEW: Function to render isolated components based on category
    const renderIsolatedComponent = () => {
        if (!injectedItem) {
            return (
                <View className="items-center justify-center opacity-30">
                    <Ionicons name="cube-outline" size={64} color="white" />
                    <Text className="text-white font-mono mt-4">AWAITING PAYLOAD...</Text>
                </View>
            );
        }

        const cat = injectedItem.category?.toUpperCase();
        const visual = injectedItem.visualConfig;

        switch (cat) {
            case 'BADGE':
                return (
                    <View className="items-center">
                        <BadgeIcon badge={injectedItem} size={100} isDark={isDark} />
                        <Text className="text-white mt-4 font-mono text-xs">Size: 100px</Text>
                    </View>
                );
            case 'BACKGROUND':
                return (
                    <View style={{ width: 320, height: 180, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
                        <PlayerBackground equippedBg={injectedItem} themeColor={visual.primaryColor || "#3b82f6"} borderRadius={24} />
                    </View>
                );
            case 'WATERMARK':
                return (
                    <View style={{ width: 320, height: 180, backgroundColor: '#0f172a', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
                        <PlayerWatermark equippedWatermark={injectedItem} isDark={isDark} />
                    </View>
                );
            case 'BORDER':
                return (
                    <ClanBorder
                        color={visual.primaryColor || "#3b82f6"}
                        secondaryColor={visual.secondaryColor}
                        animationType={visual.animationType || "singleSnake"}
                        duration={visual.duration || 3000}
                    >
                        <View style={{ width: 250, height: 250, backgroundColor: '#0f172a', borderRadius: 27, justifyContent: 'center', alignItems: 'center' }}>
                            <Text className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Inner Content</Text>
                        </View>
                    </ClanBorder>
                );
            case 'GLOW':
                return (
                    <View className="items-center justify-center gap-10 bg-[#0f172a] w-full h-full">
                        {/* Show Avatar Glow */}
                        <AuraAvatar 
                            author={mannequinUser} 
                            aura={{color: '#fbbf24', icon: 'crown'}} 
                            glowColor={visual.primaryColor} 
                            size={120} 
                            isDark={isDark} 
                        />
                        {/* Show Nameplate Glow */}
                        <PlayerNameplate 
                            author={mannequinUser} 
                            themeColor={visual.primaryColor} 
                            equippedGlow={injectedItem} 
                            auraRank={1} 
                            isDark={isDark} 
                            showFlame={true} 
                            fontSize={32} 
                        />
                    </View>
                );
            case 'AVATAR':
            case 'AVATAR_VFX':
                return (
                    <AuraAvatar 
                        author={mannequinUser} 
                        aura={{color: '#fbbf24', icon: 'crown'}} 
                        size={160} 
                        isDark={isDark} 
                    />
                );
            default:
                return (
                    <View className="items-center justify-center">
                        <Ionicons name="construct-outline" size={48} color="#ef4444" />
                        <Text className="text-red-400 font-mono mt-4 text-center">Isolated view not mapped for category:{"\n"}{cat}</Text>
                    </View>
                );
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                
                {/* ⚡️ HEADER */}
                <View className="px-4 py-4 flex-row items-center justify-between border-b border-slate-800">
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="code-json" size={24} color="#3b82f6" />
                        <Text className="text-white font-black text-lg tracking-widest uppercase ml-2 italic">Cosmetic Sandbox</Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                    
                    {/* ⚡️ VIEW TOGGLE */}
                    <View className="flex-row mx-4 mt-4 bg-slate-800/50 p-1 rounded-xl">
                        <TouchableOpacity 
                            onPress={() => setViewMode('CARD')}
                            className={`flex-1 py-2 items-center rounded-lg ${viewMode === 'CARD' ? 'bg-blue-600' : 'bg-transparent'}`}
                        >
                            <Text className={`text-[10px] font-black uppercase tracking-widest ${viewMode === 'CARD' ? 'text-white' : 'text-slate-400'}`}>Full Card</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setViewMode('ISOLATED')}
                            className={`flex-1 py-2 items-center rounded-lg ${viewMode === 'ISOLATED' ? 'bg-blue-600' : 'bg-transparent'}`}
                        >
                            <Text className={`text-[10px] font-black uppercase tracking-widest ${viewMode === 'ISOLATED' ? 'text-white' : 'text-slate-400'}`}>Isolated</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ⚡️ THE STAGE */}
                    <View className="w-full min-h-[420px] bg-[#020617] items-center justify-center py-8 mt-4 border-y border-slate-800 overflow-hidden relative">
                        
                        {viewMode === 'CARD' ? (
                            <View style={{ transform: [{ scale: Math.min(1, width / 400) }] }}>
                                <PlayerCard author={mannequinUser} totalPosts={999} isDark={isDark} />
                            </View>
                        ) : (
                            renderIsolatedComponent()
                        )}
                        
                        {injectedItem && (
                            <View className="absolute top-4 right-4 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                                <Text className="text-green-400 font-bold text-[10px] tracking-widest uppercase">
                                    INJECTED: {injectedItem.category}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ⚡️ THE CONSOLE (Input Area) */}
                    <View className="p-4">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Raw Config Payload</Text>
                            <TouchableOpacity onPress={() => setInputCode(DEFAULT_INPUT)}>
                                <Text className="text-blue-500 text-[10px] uppercase font-bold tracking-widest">Reset Template</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
                            <TextInput
                                multiline
                                value={inputCode}
                                onChangeText={setInputCode}
                                style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlignVertical: 'top' }}
                                className="text-green-400 p-4 min-h-[180px] text-xs"
                                autoCapitalize="none"
                                autoCorrect={false}
                                spellCheck={false}
                            />
                        </View>

                        {error && (
                            <View className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mt-3 flex-row items-center">
                                <Ionicons name="warning" size={16} color="#ef4444" />
                                <Text className="text-red-400 text-xs ml-2 flex-1 font-mono">{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity 
                            onPress={handleInject}
                            className="bg-blue-600 mt-4 py-4 rounded-xl items-center flex-row justify-center shadow-lg shadow-blue-900"
                        >
                            <Ionicons name="flask" size={18} color="white" />
                            <Text className="text-white font-black uppercase tracking-[0.2em] ml-2">Compile & Render</Text>
                        </TouchableOpacity>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}