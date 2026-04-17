import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryNav from '../../../components/CategoryNav';
import PostCard from '../../../components/PostCard';
import PromoCommentSection from '../../../components/PromoCommentSection';
import Topbar from '../../../components/Topbar';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const mockPost = {
    _id: 'mock-post-1',
    title: 'Gear 5 Luffy is the Ultimate Power Scaling',
    slug: 'gear-5-luffy-power',
    category: 'One Piece',
    authorData: { username: 'AnimeSage', aura: 15000, currentRankLevel: 7 },
    images: ['https://oreblogda.com/images/gear5.jpg'],
};
// 10 Viral replies to flood the drawer
const viralReplies = [
    "W take. Joyboy arc sealed it. Nika > All 🔥",
    "Finally someone says it! 📈",
    "The animation was peak though.",
    "Kaido fans in shambles right now 💀",
    "Is this the end of the debate?",
    "Haki still matters more imo...",
    "PEAK PIECE IS REAL",
    "I've watched this 10 times today.",
    "Wait until Blackbeard awakens his fruit.",
    "Absolute Cinema. 🎬"
]
const mockNames = [
    'AnimeSage', 'PowerScaler', 'MangaMaster', 'WaifuWarrior', 'ChibiChampion',
    'NinjaNerd', 'OtakuOverlord', 'ShonenShogun', 'KawaiiKing', 'HypeBeast'
];

export default function DiscussionScene({ onBack }) {
    const [step, setStep] = useState('IDLE');
    const [showOverlay, setShowOverlay] = useState(true);
    const [typingText, setTypingText] = useState(""); // We will pass this to CommentSection
    const [mockComments, setMockComments] = useState([]);
    const [activeCommentId, setActiveCommentId] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [showTyping, setShowTyping] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const scrollRef = useRef(null);
    const typingIndex = useRef(0);

    const activeDiscussion = mockComments.find(c => c._id === activeCommentId) || null;

    // --- 1. The Typing Engine ---
    const simulateTyping = async (textToType) => {
        setStep('TYPING_MESSAGE');
        for (let i = 0; i <= textToType.length; i++) {
            setTypingText(textToType.slice(0, i));
            // Random delay between characters for "human" feel
            await new Promise(r => setTimeout(r, Math.random() * 30 + 20));
        }
    };

    // --- 2. The Viral Flood Engine ---
    const startViralFlood = (commentId) => {
        setStep('VIRAL_FEED_ACTIVE');
        let index = 0;
        const interval = setInterval(() => {
            if (index < viralReplies.length) {
                setIsPosting(true);
                setTimeout(() => setIsPosting(false), 500);
                const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
                const newReply = {
                    _id: `viral-${Date.now()}-${index}`,
                    name: randomName,
                    text: viralReplies[index],
                    date: new Date().toISOString(),
                    author: { name: randomName, auraRank: Math.floor(Math.random() * 10) }
                };

                // Logic to inject this into the specific discussion thread
                setMockComments(prev => prev.map(c =>
                    c._id === commentId
                        ? { ...c, replies: [...(c.replies || []), newReply] }
                        : c
                ));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                index++;
            } else {
                clearInterval(interval);
                setStep('PROMO_COMPLETE');
            }
        }, 600); // New reply every 600ms
    };

    // --- 3. The Main Sequence ---
    useEffect(() => {
        const runPromo = async () => {
            // Step 1: Wait & Scroll (3s)
            await new Promise(r => setTimeout(r, 2000));
            setShowOverlay(false); // Hide overlay once animation starts
            setStep('SCROLLING_TO_COMMS');
            scrollRef.current?.scrollTo({ y: 550, animated: true });

            // Step 2: Auto-Type (starts at 5s)
            await new Promise(r => setTimeout(r, 1500));
            await simulateTyping("Gear 5 is literally peak fiction. The drums of liberation change everything! 🔥 Let me get people who agrees with me in here");

            // Step 3: Auto-Send
            await new Promise(r => setTimeout(r, 800));
            const newId = `comment-${Date.now()}`;
            const randomMainName = mockNames[Math.floor(Math.random() * mockNames.length)];
            const myComment = {
                _id: newId,
                name: randomMainName,
                text: "Gear 5 is literally peak fiction. The drums of liberation change everything! 🔥 Let me get people who agrees with me in here",
                date: new Date().toISOString(),
                replies: [],
                author: { name: randomMainName, auraRank: 9 }
            };
            setMockComments([myComment]);
            setTypingText(""); // Clear input
            setStep('SIGNAL_TRANSMITTED');

            // Step 4: Open Drawer (Handled by discussionIdfromPage in CommentSection)
            await new Promise(r => setTimeout(r, 1000));
            setActiveCommentId(myComment._id);
            setHighlightId(myComment._id);
            setStep('OPENING_DISCUSSION');

            // Step 5: Share
            await new Promise(r => setTimeout(r, 1500));
            setStep('SHARING_INTEL');
            try {
                await Share.share({ message: 'Check this take on Oreblogda!' });
                // Step 6: Viral Flood starts after share returns
                startViralFlood(myComment._id);
            } catch (e) {
                startViralFlood(myComment._id); // Fallback if share is cancelled
            }
        };

        runPromo();
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
            author: { name: randomName, auraRank: 9 }
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
            <Topbar isDark={true} />
            <CategoryNav />
            <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 100 }}>
                <PostCard post={mockPost} isDark={true} />

                <PromoCommentSection
                    mockComments={mockComments}
                    onAddComment={(text) => {
                        const newId = `comment-${Date.now()}`;
                        const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
                        const myComment = {
                            _id: newId,
                            name: randomName,
                            text: text,
                            date: new Date().toISOString(),
                            replies: [],
                            author: { name: randomName, auraRank: 9 }
                        };
                        setMockComments([myComment]);
                    }}
                    onOpenDiscussion={handleOpenDiscussion}
                    onReply={handleReply}
                    showTyping={showTyping}
                    isPosting={isPosting}
                    activeDiscussion={activeDiscussion}
                    onCloseDiscussion={handleCloseDiscussion}
                    highlightId={highlightId}
                    slug={mockPost.slug}
                    controlledText={typingText}
                    onTextChange={setTypingText}
                />
            </ScrollView>

            {/* Cinematic Overlay Label - Hidden during recording */}
            {showOverlay && (
                <View className="absolute top-12 self-center bg-blue-600/20 px-4 py-1 rounded-full border border-blue-500/50">
                    <Text className="text-blue-400 font-mono text-[10px] tracking-[0.3em]">
                        {step.replace(/_/g, ' ')}
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
}