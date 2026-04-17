import { createContext, useContext } from 'react';
import { ClanProvider } from '../ClanContext';
import { UserProvider } from '../UserContext';

const MockMarketingUserContext = createContext();

export const MockUserProvider = ({ children }) => {
    const mockUser = {
        username: 'DEMO_FLEX',
        aura: 9999,
        weeklyAura: 2500,
        previousRank: 9000,
        rank: 1,
        deviceId: 'FLEX_9000',
        postCount: 150,
        streak: 45,
        peakLevel: 7,
        totalPurchasedCoins: 15000,
        description: 'Witness the transformation...',
        preferences: { favCharacter: 'MONARCH' },
        profilePic: { url: null },
        inventory: []
    };

    return (
        <UserProvider>
            <MockMarketingUserContext.Provider value={{ user: mockUser }}>
                {children}
            </MockMarketingUserContext.Provider>
        </UserProvider>
    );
};

export const MockClanProviderWrapper = ({ children }) => {
    const mockClan = {
        tag: 'FLEX',
        points: 125000,
        followerCount: 850,
        rankTitle: 'Akatsuki',
        rank: 1
    };

    return (
        <ClanProvider>
            <MockMarketingUserContext.Provider value={{ userClan: mockClan }}>
                {children}
            </MockMarketingUserContext.Provider>
        </ClanProvider>
    );
};

export const useMockContext = () => useContext(MockMarketingUserContext);

