import { vi } from 'vitest';
import type { PublicUser } from '@graph-playground/shared';
import type { AuthApi } from './authApi';

export const ann: PublicUser = { id: 'user-ann', email: 'ann@example.com' };

// An AuthApi for tests. By default nobody is signed in and every call works. Pass overrides to change that.
export function createFakeAuthApi(overrides: Partial<AuthApi> = {}) {
    const api = {
        me: vi.fn<AuthApi['me']>().mockResolvedValue(null),
        login: vi.fn<AuthApi['login']>().mockResolvedValue({ ok: true, user: ann }),
        register: vi.fn<AuthApi['register']>().mockResolvedValue({ ok: true, user: ann }),
        logout: vi.fn<AuthApi['logout']>().mockResolvedValue(undefined),
        ...overrides,
    };
    return api;
}