import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StaffSession } from './types';

type AppState = {
  session: StaffSession | null;
  setSession: (session: StaffSession | null) => void;
  lastSearchedOrderId: string | null;
  setLastSearchedOrderId: (orderId: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      lastSearchedOrderId: null,
      setLastSearchedOrderId: (orderId) => set({ lastSearchedOrderId: orderId }),
    }),
    {
      name: 'laundry-wash-web-state',
      partialize: (state) => ({
        session: state.session,
        lastSearchedOrderId: state.lastSearchedOrderId,
      }),
    },
  ),
);
