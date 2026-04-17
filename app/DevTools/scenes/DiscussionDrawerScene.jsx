import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PromoCommentSection from '../../../components/PromoCommentSection';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const mockNames = [
    'AnimeSage', 'PowerScaler', 'MangaMaster', 'WaifuWarrior', 'ChibiChampion',
    'NinjaNerd', 'OtakuOverlord', 'ShonenShogun', 'KawaiiKing', 'HypeBeast',
    'DragonSlayer', 'ShadowNinja', 'MysticMage', 'BeastTamer', 'VoidWalker',
    'StormBringer', 'FlameKeeper', 'IceQueen', 'ThunderLord', 'WindWhisperer'
];
const mockCommentTexts = [
    "This is absolutely insane! 🔥",
    "Finally someone gets it right",
    "Peak fiction right here 📈",
    "The animation was flawless",
    "Can't wait for the next episode!",
    "This changes everything...",
    "Absolute masterpiece 🎬",
    "I've watched this 5 times already",
    "The soundtrack hits different",
    "Character development is top tier",
    "Plot twists everywhere!",
    "Visuals are stunning 😍",
    "This arc is legendary",
    "Emotional rollercoaster ride",
    "Fight scenes are incredible",
    "World building is amazing",
    "The hype is real!",
    "This is why I love anime",
    "Mind blown 🤯",
    "Can't stop thinking about it",
    "The lore is so deep",
    "Character designs are perfect",
    "This episode broke me",
    "Pure cinematic excellence",
    "The tension is unreal",
    "Every frame is beautiful",
    "This is art at its finest",
    "The voice acting is phenomenal",
    "Storytelling perfection",
    "This deserves all the awards",
    "The pacing is perfect",
    "Emotional depth is incredible",
    "The symbolism is everywhere",
    "This is a work of genius",
    "Can't wait to discuss this more",
    "The fan service was perfect",
    "Action sequences are epic",
    "The comedy timing is spot on",
    "This is peak entertainment",
    "The themes are so relevant",
    "This is why anime is superior",
    "The production quality is insane",
    "Every character is well written",
    "This is a masterpiece",
    "The atmosphere is perfect",
    "This episode was emotional",
    "The cinematography is gorgeous",
    "This is pure gold",
    "The sound design is amazing",
    "This is why I watch anime"
];

const generateMockComments = (count) => {
    const comments = [];
    for (let i = 0; i < count; i++) {
        const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
        const randomText = mockCommentTexts[Math.floor(Math.random() * mockCommentTexts.length)];
        comments.push({
            _id: `mock-comment-${i}`,
            name: randomName,
            text: `${randomText} #${i + 1}`,
            date: new Date(Date.now() - i * 60000).toISOString(), // Each comment 1 minute apart
            author: { name: randomName, auraRank: Math.floor(Math.random() * 10) + 1 }
        });
    }
    return comments;
};

export default function DiscussionDrawerScene({ onBack }) {
    const [mockComments, setMockComments] = useState([]);
    const [activeCommentId, setActiveCommentId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const scrollRef = useRef(null);

    const activeDiscussion = mockComments.find(c => c._id === activeCommentId) || null;

    useEffect(() => {
        // Generate 100 mock comments
        const comments = generateMockComments(100);
        setMockComments(comments);

        // Set the first comment as active to open the drawer
        setTimeout(() => {
            setActiveCommentId(comments[0]._id);
            setHighlightId(comments[0]._id);
        }, 500);
    }, []);

    const handleOpenDiscussion = (comment) => {
        setActiveCommentId(comment._id);
        setHighlightId(comment._id);
    };

    const handleReply = (parentId, replyText) => {
        const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
        const newReply = {
            _id: `reply-${Date.now()}`,
            name: randomName,
            text: replyText,
            date: new Date().toISOString(),
            author: { name: randomName, auraRank: Math.floor(Math.random() * 10) + 1 }
        };
        setMockComments(prev => prev.map(c =>
            c._id === parentId
                ? { ...c, replies: [...(c.replies || []), newReply] }
                : c
        ));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleCloseDiscussion = () => {
        setActiveCommentId(null);
        setHighlightId(null);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#050505]">
            <View className="flex-1">
                <PromoCommentSection
                    mockComments={mockComments}
                    onAddComment={() => { }} // Disable adding new comments
                    onOpenDiscussion={handleOpenDiscussion}
                    onReply={handleReply}
                    showTyping={false}
                    isPosting={false}
                    activeDiscussion={activeDiscussion}
                    onCloseDiscussion={handleCloseDiscussion}
                    highlightId={highlightId}
                    slug="discussion-drawer-demo"
                    controlledText=""
                    onTextChange={() => { }} />
            </View>
        </SafeAreaView>
    );
}