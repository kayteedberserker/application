import { Link, Stack, usePathname } from 'expo-router';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '../components/Text'; 
import Animated, { 
  FadeIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming,
  withSequence,
  withDelay
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotFoundScreen() {
  const pathname = usePathname();
  const [suggestion, setSuggestion] = useState(null);
  
  // Glitch Animation Values
  const glitchOffset = useSharedValue(0);
  const loadingBar = useSharedValue(0);

  useEffect(() => {
    // Start Glitch Loop
    glitchOffset.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 50 }),
        withTiming(-2, { duration: 50 }),
        withTiming(0, { duration: 50 })
      ),
      -1,
      true
    );

    // Start Loading Bar Loop
    loadingBar.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      false
    );

    // --- SMART ROUTE DETECTION ---
    const lowerPath = pathname.toLowerCase();
    if (lowerPath.includes('leaderboard') || lowerPath.includes('rank')) {
      setSuggestion({ label: 'Leaderboard Sector', path: '/screens/Leaderboard', icon: 'trophy' });
    } else if (lowerPath.includes('post')) {
      setSuggestion({ label: 'Main Archive', path: '/', icon: 'newspaper' });
    } else if (lowerPath.includes('user') || lowerPath.includes('profile')) {
      setSuggestion({ label: 'User Database', path: '/', icon: 'at' });
    }
  }, [pathname]);

  const glitchStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glitchOffset.value }],
    opacity: 0.9 + Math.random() * 0.1,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${loadingBar.value * 100}%`,
  }));

  return (
    <>
      <Stack.Screen options={{ title: 'SYSTEM_BREACH', headerShown: false }} />
      
      <View className="flex-1 bg-white dark:bg-[#050505] items-center justify-center p-8">
        
        {/* --- BACKGROUND DECOR --- */}
        <View className="absolute inset-0 z-0 opacity-20 dark:opacity-40">
            <View 
                style={{ position: 'absolute', top: '50%', left: '50%', width: 400, height: 400, backgroundColor: '#ef4444', borderRadius: 200, transform: [{translateX: -200}, {translateY: -200}], opacity: 0.1 }} 
            />
            <View className="absolute inset-0" style={styles.scanlines} />
        </View>

        <Animated.View entering={FadeIn.duration(800)} className="items-center z-10">
          
          {/* Main Glitch 404 */}
          <View className="relative">
             <Animated.Text style={glitchStyle} className="text-8xl md:text-9xl font-black italic tracking-tighter text-red-600">
                404
             </Animated.Text>
             {/* Glitch Ghost 1 */}
             <Animated.Text 
                style={[glitchStyle, { position: 'absolute', left: 2, top: 0, color: '#3b82f6', opacity: 0.3 }]} 
                className="text-8xl md:text-9xl font-black italic tracking-tighter"
             >
                404
             </Animated.Text>
          </View>

          <View className="mt-4 mb-8 items-center">
            <Text className="text-xl font-black uppercase tracking-[0.3em] text-gray-900 dark:text-white mb-2">
              System Breach: Sector Not Found
            </Text>
            <View className="h-[2px] w-24 bg-red-600" />
          </View>

          {/* Terminal Console */}
          <View className="w-full max-w-sm bg-gray-100 dark:bg-gray-900/80 p-5 rounded-2xl border border-gray-200 dark:border-red-900/30 mb-10">
            <Text className="text-[10px] text-red-500 font-mono leading-5">
              &gt; ERROR_CODE: 0x00000404{'\n'}
              &gt; STATUS: NULL_POINTER_EXCEPTION{'\n'}
              &gt; ATTEMPTED_PATH: {pathname}{'\n'}
              &gt; MESSAGE: Requested intel folder purged.
            </Text>
            <View className="flex-row gap-2 mt-3">
              <View className="w-2 h-2 bg-red-600 rounded-full" />
              <View className="w-2 h-2 bg-red-600 rounded-full opacity-50" />
              <View className="w-2 h-2 bg-red-600 rounded-full opacity-20" />
            </View>
          </View>

          {/* --- SMART SUGGESTION --- */}
          {suggestion && (
            <Animated.View entering={FadeIn.delay(400)} className="mb-6 w-full">
              <Text className="text-[10px] text-blue-500 font-black uppercase text-center mb-3 tracking-widest">
                — Intelligence suggest you meant: —
              </Text>
              <Link href={suggestion.path} asChild>
                <Pressable className="bg-blue-600/10 border border-blue-500/30 flex-row items-center justify-center py-3 rounded-xl gap-3">
                  <MaterialCommunityIcons name={suggestion.icon} size={18} color="#3b82f6" />
                  <Text className="text-blue-500 font-black uppercase tracking-tight text-xs">
                    Access {suggestion.label}
                  </Text>
                </Pressable>
              </Link>
            </Animated.View>
          )}

          {/* --- MAIN ACTION --- */}
          <Link href="/" asChild>
            <Pressable className="group relative w-full overflow-hidden bg-gray-900 dark:bg-white px-12 py-5 rounded-2xl items-center justify-center">
              <Text className="text-white dark:text-black font-black uppercase italic tracking-widest text-sm z-10">
                Initiate Return Sequence →
              </Text>
              {/* Internal Loading Bar Decor */}
              <Animated.View 
                style={[progressBarStyle]} 
                className="absolute bottom-0 left-0 h-1 bg-blue-600" 
              />
            </Pressable>
          </Link>

        </Animated.View>

        <Text className="absolute bottom-10 text-[8px] font-mono uppercase tracking-[0.5em] text-gray-400 opacity-50">
          Oreblogda_Kernel_v4.0 // Fatal_Error_Handler
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scanlines: {
    backgroundImage: 'repeating-linear-gradient(0deg, #ff0000 0px, transparent 1px, transparent 2px)',
    backgroundSize: '100% 3px',
    opacity: 0.05
  }
});
