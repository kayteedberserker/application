import { Image } from 'expo-image';


// 🪙 Reusable Coin Icon Component (Using the simple 2D design concept)
const CoinIcon = ({ type = 'OC', size = 16 }) => {
    // Note: Update these paths once you've saved your transparent 2D PNGs
    const source = type === 'OC' 
      ? require('../assets/images/orecoin.png') 
      : require('../assets/images/clancoin.png');
  
    return (
      <Image 
        source={source} 
        style={{ width: size, height: size, resizeMode: 'contain' }} 
      />
    );
};

export default CoinIcon;