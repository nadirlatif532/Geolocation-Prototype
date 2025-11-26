import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    // User info
    userId: string;
    isGuest: boolean;
    isLinked: boolean;
    linkedAccountId: string | null;

    // Actions
    linkAccount: (token: string) => Promise<boolean>;
    resetAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            // Initial state - guest mode by default
            userId: `guest_${Date.now()}`,
            isGuest: true,
            isLinked: false,
            linkedAccountId: null,

            /**
             * Link guest account to main MMO account
             * PLACEHOLDER: Currently mocked for architecture reservation
             */
            linkAccount: async (token: string) => {
                console.log('[Auth] Attempting to link account with token:', token);

                // MOCK IMPLEMENTATION - Replace with real API call
                return new Promise((resolve) => {
                    setTimeout(() => {
                        if (token === '123' || token.startsWith('VALID_')) {
                            const linkedAccountId = `mmo_${Math.random().toString(36).substring(7)}`;

                            set({
                                isGuest: false,
                                isLinked: true,
                                linkedAccountId,
                            });

                            console.log('[Auth] Account linked successfully:', linkedAccountId);
                            resolve(true);
                        } else {
                            console.error('[Auth] Invalid token');
                            resolve(false);
                        }
                    }, 500); // Simulate network delay
                });
            },

            /**
             * Reset to guest mode (for testing)
             */
            resetAuth: () => {
                set({
                    userId: `guest_${Date.now()}`,
                    isGuest: true,
                    isLinked: false,
                    linkedAccountId: null,
                });
                console.log('[Auth] Reset to guest mode');
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);
