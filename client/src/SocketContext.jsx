import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io('/', {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
    });
    const bump = (payload) => {
      setTick((n) => n + 1);
      if (payload?.message) setToast(payload.message);
    };
    socket.on('schedule:changed', bump);
    socket.on('schedule:published', bump);
    socket.on('swap:updated', bump);
    socket.on('notification', (n) => {
      setTick((x) => x + 1);
      setToast(n.title);
    });
    socket.on('onduty:changed', bump);
    socket.on('assign:conflict', (p) => setToast(p.message));
    return () => socket.close();
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <SocketContext.Provider value={{ tick, toast, setToast }}>
      {children}
      {toast ? <div className="toast">{toast}</div> : null}
    </SocketContext.Provider>
  );
}

export function useLive() {
  return useContext(SocketContext);
}
