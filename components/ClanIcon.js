import { Image } from 'expo-image';
import React from 'react';

// ⚡️ PERFORMANCE: Memoize the icon so it doesn't re-render unless type or size changes
const CoinIcon = React.memo(({ type = 'OC', size = 16, style }) => {

  // Note: Update these paths once you've saved your transparent 2D PNGs
  const source = type === 'OC'
    ? require('../assets/images/orecoin.png')
    : require('../assets/images/clancoin.png');

  return (
    <Image
      source={source}
      // ⚡️ PERFORMANCE: contentFit="contain" is more optimized in expo-image than style: {resizeMode}
      contentFit="contain"
      // ⚡️ PERFORMANCE: transition adds a very subtle fade-in so it doesn't "pop" harshly
      transition={200}
      style={[
        {
          width: size,
          height: size
        },
        style // Allow passing extra styles like margins
      ]}
    />
  );
});

// Give it a display name for easier debugging in React DevTools
CoinIcon.displayName = 'CoinIcon';

export default CoinIcon;