import React, { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import apiFetch from '../utils/apiFetch';

const EventContext = createContext();

const fetcher = (url) => apiFetch(url).then(res => res.json());

export const EventProvider = ({ children }) => {
    // Fetch the active events from the server. 
    // It refreshes every 5 minutes just in case an event expires or starts!
    const { data, error, mutate } = useSWR('/events/active', fetcher, {
        refreshInterval: 600000,
        revalidateOnFocus: true
    });

    // 🧠 MEMOIZED CONTEXT VALUE TO PREVENT UNNECESSARY CONSUMER RERENDERS
    const contextValue = useMemo(() => {
        // ⚡️ FIXED: Now expects an array of events from the server
        // e.g., data.events = [{ id: '1', type: 'claim' }, { id: '2', type: 'gacha', gachaType: 'GRID' }]
        const activeEvents = data?.events || [];
        const isLoading = !data && !error;

        return {
            activeEvents,     // Exposes the full array of active events to the app
            isLoading,
            fetchEvents: mutate // Renamed slightly to make sense for multiple events
        };
    }, [data, error, mutate]);

    return (
        <EventContext.Provider value={contextValue}>
            {children}
        </EventContext.Provider>
    );
};

export const useEvent = () => useContext(EventContext);