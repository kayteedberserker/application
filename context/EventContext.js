import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import apiFetch from '../utils/apiFetch';
const EventContext = createContext();
export const EventProvider = ({ children }) => {
    const [activeEvents, setActiveEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fetchEvents = useCallback(async () => {
        try {
            const res = await apiFetch('/events/active');
            if (res.ok) {
                const data = await res.json();
                setActiveEvents(data?.events || []);
            }
        } catch (err) {
            console.error("Failed to fetch active events manually:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);
    const setEventsData = useCallback((events) => {
        setActiveEvents(events || []);
        setIsLoading(false);
    }, []);
    const contextValue = useMemo(() => ({
        activeEvents,
        isLoading,
        fetchEvents,
        setEvents: setEventsData
    }), [activeEvents, isLoading, fetchEvents, setEventsData]);
    return (
        <EventContext.Provider value={contextValue}>
            {children}
        </EventContext.Provider>
    );
};
export const useEvent = () => useContext(EventContext);