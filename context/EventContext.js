import React, { createContext, useContext } from 'react';
import useSWR from 'swr';
import apiFetch from '../utils/apiFetch';

const EventContext = createContext();

const fetcher = (url) => apiFetch(url).then(res => res.json());

export const EventProvider = ({ children }) => {
    // Fetch the active event from the server. 
    // It refreshes every 5 minutes just in case an event expires or starts!
    const { data, error, mutate } = useSWR('/events/active', fetcher, {
        refreshInterval: 300000, 
        revalidateOnFocus: true
    });

    const activeEvent = data?.event || null;
    const isLoading = !data && !error;
    
    return (
        <EventContext.Provider value={{
            activeEvent,
            isLoading,
            refreshEvent: mutate
        }}>
            {children}
        </EventContext.Provider>
    );
};

export const useEvent = () => useContext(EventContext);