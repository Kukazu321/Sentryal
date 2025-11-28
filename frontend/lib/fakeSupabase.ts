type Session = { 
  user: { id: string; email?: string }; 
  access_token?: string;
} | null;

function makeSubscription(unsub: () => void) {
    return { subscription: { unsubscribe: unsub } };
}

export default function createFakeSupabase() {
    // Try to restore session from localStorage
    const STORAGE_KEY = 'fake_supabase_session';
    let currentSession: Session = null;
    
    // Restore session from localStorage on init
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                currentSession = JSON.parse(stored);
            }
        } catch (e) {
            // Ignore errors
        }
    }
    
    const listeners: Array<(event: string, sess: Session) => void> = [];

    function notify(event: string, sess: Session) {
        listeners.forEach((l) => l(event, sess));
        // Save to localStorage whenever session changes
        if (typeof window !== 'undefined') {
            try {
                if (sess) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {
                // Ignore errors
            }
        }
    }

    return {
        auth: {
            async getSession() {
                // Return a promise that resolves immediately
                return Promise.resolve({ data: { session: currentSession }, error: null });
            },
            onAuthStateChange(cb: (event: string, session: Session) => void) {
                listeners.push(cb);
                return makeSubscription(() => {
                    const idx = listeners.indexOf(cb);
                    if (idx >= 0) listeners.splice(idx, 1);
                });
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            async signUp({ email, password: _password }: { email: string; password: string }) {
                // create a fake user
                const id = `local-${Date.now()}`;
                const tokenData = JSON.stringify({ id, email });
                // Use btoa for browser-compatible base64 encoding
                const fakeToken = typeof btoa !== 'undefined' ? btoa(tokenData) : Buffer.from(tokenData).toString('base64');
                currentSession = { 
                    user: { id, email },
                    access_token: fakeToken
                };
                notify('SIGNED_UP', currentSession);
                return { data: { user: currentSession.user, session: currentSession }, error: null };
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            async signInWithPassword({ email, password: _password }: { email: string; password: string }) {
                // accept any password in dev
                const id = `local-${Date.now()}`;
                // Create a fake token (base64 encoded JSON with email and id)
                const tokenData = JSON.stringify({ id, email });
                // Use btoa for browser-compatible base64 encoding
                const fakeToken = typeof btoa !== 'undefined' ? btoa(tokenData) : Buffer.from(tokenData).toString('base64');
                currentSession = { 
                    user: { id, email },
                    access_token: fakeToken
                };
                notify('SIGNED_IN', currentSession);
                return { data: { session: currentSession }, error: null };
            },
            async signOut() {
                currentSession = null;
                notify('SIGNED_OUT', null);
                return { error: null };
            },
        },
    } as const;
}
