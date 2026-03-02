import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

export const SigilLibrary = {
  // ITACI MANGEKYOU
  sharingan: (color) => (
    <G>
      <Circle cx="50" cy="50" r="45" stroke={color} strokeWidth="1" fill="none" opacity={0.3} />
      <Path
        d="M50 20C35 20 25 35 25 50C25 65 35 80 50 80C65 80 75 65 75 50C75 35 65 20 50 20ZM50 70C39 70 30 61 30 50C30 39 39 30 50 30C61 30 70 39 70 50C70 61 61 70 50 70Z"
        fill={color}
      />
      {/* Three Tomoe/Blades */}
      <Path d="M50 35 L55 45 L45 45 Z" fill={color} transform="rotate(0 50 50)" />
      <Path d="M50 35 L55 45 L45 45 Z" fill={color} transform="rotate(120 50 50)" />
      <Path d="M50 35 L55 45 L45 45 Z" fill={color} transform="rotate(240 50 50)" />
      <Circle cx="50" cy="50" r="6" fill={color} />
    </G>
  ),
  // HIDDEN LEAF SWIRL
  leaf: (color) => (
    <G>
      <Path
        d="M50 10C27.9 10 10 27.9 10 50C10 72.1 27.9 90 50 90C72.1 90 90 72.1 90 50"
        stroke={color}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M50 50 Q70 30 90 50" stroke={color} strokeWidth="8" fill="none" />
      <Path d="M85 45 L95 50 L85 55 Z" fill={color} />
    </G>
  )
};

export const CardWatermark = ({ name, color = "#ff0000", size = 300 }) => {
  const Sigil = SigilLibrary[name];
  if (!Sigil) return null;

  return (
    <View style={{ position: 'absolute', opacity: 0.1, alignSelf: 'center', top: '10%' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {Sigil(color)}
      </Svg>
    </View>
  );
};