import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@luxai/shared';

interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  kycStatus: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'luxai-auth',
    }
  )
);
