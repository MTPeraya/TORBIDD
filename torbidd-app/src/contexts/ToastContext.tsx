'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'info' | 'error' | 'success';

interface ToastMessage {
  id: number;
  message: string;
  icon?: React.ReactNode;
  type?: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, icon?: React.ReactNode, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, icon?: React.ReactNode, type: ToastType = 'info') => {
    const id = Date.now();
    setToast({ id, message, icon, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        id="toast"
        className={`toast ${toast ? 'show' : ''} ${toast?.type === 'error' ? 'toast-error' : ''}`}
      >
        {toast?.icon}
        <span>{toast?.message}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
