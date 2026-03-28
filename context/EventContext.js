import React, { createContext, useContext } from 'react';
import useSWR from 'swr';
import apiFetch from '../utils/apiFetch';

const EventContext = createContext();

const fetcher = (url) => apiFetch(url).then(res => res.json());

export const EventProvider = ({ children }) => {
    // Fetch the active events from the server. 
    // It refreshes every 5 minutes just in case an event expires or starts!
    const { data, error, mutate } = useSWR('/events/active', fetcher, {
        refreshInterval: 300000, 
        revalidateOnFocus: true
    });

    // ⚡️ FIXED: Now expects an array of events from the server
    // e.g., data.events = [{ id: '1', type: 'claim' }, { id: '2', type: 'gacha', gachaType: 'GRID }]
    const activeEvents = data?.events || []
    
    const isLoading = !data && !error;
    
    return (
        <EventContext.Provider value={{
            activeEvents,     // Exposes the full array of active events to the app
            isLoading,
            fetchEvents: mutate // Renamed slightly to make sense for multiple events
        }}>
            {children}
        </EventContext.Provider>
    );
};

export const useEvent = () => useContext(EventContext);