import App from './App';
import { useAuth } from './auth/useAuth';
import { StorageProvider } from './persistence/StorageProvider';

export function Root() {
    const { state, sessionEnded } = useAuth();

    // A moment at startup while the server is asked who is signed in. Nothing is shown rather than the wrong storage.
    if (state.status === 'loading') return null;

    const userId = state.status === 'signedIn' ? state.user.id : null;

    return (
        <StorageProvider userId={userId} onUnauthorized={sessionEnded}>
            <App />
        </StorageProvider>
    );
}