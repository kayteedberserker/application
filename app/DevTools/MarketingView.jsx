import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 🎬 Scene Components
import DiscussionDrawerScene from './scenes/DiscussionDrawerScene';
import DiscussionScene from './scenes/DiscussionScene';
import PlayerCardScene from './scenes/PlayerCardScene';
import TitleShowcaseScene from './scenes/TitleShowcaseScene';

export default function MarketingView() {
    const [currentScene, setCurrentScene] = useState(null);

    if (currentScene === 'DISCUSSION_DRAWER') {
        return <DiscussionDrawerScene onBack={() => setCurrentScene(null)} />;
    }

    if (currentScene === 'PLAYER_CARD') {
        return <PlayerCardScene onBack={() => setCurrentScene(null)} />;
    }

    if (currentScene === 'DISCUSSION') {
        return <DiscussionScene onBack={() => setCurrentScene(null)} />;
    }

    if (currentScene === 'TITLES') {
        return <TitleShowcaseScene onBack={() => setCurrentScene(null)} />;
    }

    return (
        <SafeAreaView className="flex-1 bg-[#050505] p-6">
            <Text className="text-white text-3xl font-black mb-2">MARKETING HUB</Text>
            <Text className="text-gray-500 mb-10">Select a cinematic to record</Text>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
                <TouchableOpacity
                    onPress={() => setCurrentScene('PLAYER_CARD')}
                    className="p-6 bg-purple-900/20 border border-purple-500/30 rounded-3xl"
                >
                    <Text className="text-purple-400 font-bold text-lg">Player Card Evolution</Text>
                    <Text className="text-gray-400 text-sm mt-1">12s Cinematic: Rank #15 to #1</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentScene('DISCUSSION')}
                    className="p-6 bg-blue-900/20 border border-blue-500/30 rounded-3xl"
                >
                    <Text className="text-blue-400 font-bold text-lg">Community Viral Loop</Text>
                    <Text className="text-gray-400 text-sm mt-1">Share interaction & viral comment influx</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentScene('DISCUSSION_DRAWER')}
                    className="p-6 bg-green-900/20 border border-green-500/30 rounded-3xl"
                >
                    <Text className="text-green-400 font-bold text-lg">Discussion Drawer Demo</Text>
                    <Text className="text-gray-400 text-sm mt-1">100 comments scrolling showcase</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentScene('TITLES')}
                    className="p-6 bg-yellow-900/20 border border-yellow-500/30 rounded-3xl"
                >
                    <Text className="text-yellow-400 font-bold text-lg">Title Showcase</Text>
                    <Text className="text-gray-400 text-sm mt-1">Cycle through all title tiers</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}