'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '../../../../context/AuthProvider';
import localFont from 'next/font/local';

const neueLight = localFont({ src: '../../../../public/fonts/NeueHaasDisplayLight.ttf', display: 'swap' });

export default function Login() {
  const { signIn, signOut, user, loading } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated (unless forced reauth)
  useEffect(() => {
    const forceReauth = searchParams?.get('reauth') === '1';
    if (user && !loading && !forceReauth) {
      const next = searchParams?.get('next') || '/dashboard';
      router.replace(next);
    }
  }, [user, loading, router, searchParams]);

  // If forced reauth, clear any stale session on mount
  useEffect(() => {
    const forceReauth = searchParams?.get('reauth') === '1';
    if (forceReauth) {
      (async () => {
        try { await signOut(); } catch { }
      })();
    }
  }, [searchParams, signOut]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      // sign in
      const res = await signIn(email.trim(), password);
      // si signIn renvoie un objet d'erreur
      if (res && (res as any).message) {
        setError((res as any).message);
      } else {
        // Redirect to next or dashboard
        const next = searchParams?.get('next') || '/dashboard';
        await router.push(next);
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  // Afficher un loader pendant le chargement initial seulement
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'white'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="login-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'white',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            maxWidth: '1200px',
            backgroundColor: 'white',
            overflow: 'hidden',
            borderRadius: '10px',
          }}
        >
          {/* Left Side: Form */}
          <div
            style={{
              flex: 1,
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              backgroundColor: '#f8f9fa',
            }}
          >
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '8px',
                textAlign: 'left',
              }}
            >
              Log in to your account
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: '#666',
                marginBottom: '32px',
                textAlign: 'left',
                lineHeight: '1.4',
              }}
            >
              A journey beyond the known stars, where memory and destiny collide.
            </p>

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div style={{ color: '#d32f2f', fontSize: '14px', marginBottom: '8px' }} role="alert">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#333',
                    marginBottom: '4px',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="Input your email"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#333',
                    marginBottom: '4px',
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="Input your password"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className={neueLight.className}
                disabled={submitting}
                style={{
                  backgroundColor: '#000',
                  color: 'white',
                  padding: '14px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Logging in...' : 'Log In'}
              </button>
              <div style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
                Don't have an account? <a href="/auth/signup" style={{ color: '#000', textDecoration: 'underline' }}>Sign up</a>
              </div>
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #e0e0e0',
                  margin: '8px 0',
                }}
              />
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
                  color: '#333',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  style={{
                    width: '24px',
                    height: '24px',
                    flexShrink: 0
                  }}
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <g fill="#C22E33">
                      <path d="M7.754 2l.463.41c.343.304.687.607 1.026.915C11.44 5.32 13.3 7.565 14.7 10.149c.072.132.137.268.202.403l.098.203-.108.057-.081-.115-.21-.299-.147-.214c-1.019-1.479-2.04-2.96-3.442-4.145a6.563 6.563 0 00-1.393-.904c-1.014-.485-1.916-.291-2.69.505-.736.757-1.118 1.697-1.463 2.653-.045.123-.092.245-.139.367l-.082.215-.172-.055c.1-.348.192-.698.284-1.049.21-.795.42-1.59.712-2.356.31-.816.702-1.603 1.093-2.39.169-.341.338-.682.5-1.025h.092z"></path>
                      <path d="M8.448 11.822c-1.626.77-5.56 1.564-7.426 1.36C.717 11.576 3.71 4.05 5.18 2.91l-.095.218a4.638 4.638 0 01-.138.303l-.066.129c-.76 1.462-1.519 2.926-1.908 4.53a7.482 7.482 0 00-.228 1.689c-.01 1.34.824 2.252 2.217 2.309.67.027 1.347-.043 2.023-.114.294-.03.587-.061.88-.084.108-.008.214-.021.352-.039l.231-.028z"></path>
                      <path d="M3.825 14.781c-.445.034-.89.068-1.333.108 4.097.39 8.03-.277 11.91-1.644-1.265-2.23-2.97-3.991-4.952-5.522.026.098.084.169.141.239l.048.06c.17.226.348.448.527.67.409.509.818 1.018 1.126 1.578.778 1.42.356 2.648-1.168 3.296-1.002.427-2.097.718-3.18.892-1.03.164-2.075.243-3.119.323z"></path>
                    </g>
                  </g>
                </svg>
                <span style={{ lineHeight: 1.2 }}>Login with SAML 2.0</span>
              </button>
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
                  color: '#333',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    width: '24px',
                    height: '24px',
                    flexShrink: 0
                  }}
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <rect x="17" y="17" width="10" height="10" fill="#FEBA08"></rect>
                    <rect x="5" y="17" width="10" height="10" fill="#05A6F0"></rect>
                    <rect x="17" y="5" width="10" height="10" fill="#80BC06"></rect>
                    <rect x="5" y="5" width="10" height="10" fill="#F25325"></rect>
                  </g>
                </svg>
                <span style={{ lineHeight: 1.2 }}>Login with Azure</span>
              </button>
            </form>
          </div>
          {/* Right Side: Image */}
          <div
            style={{
              flex: 1,
              backgroundImage: `url('/media/formlogin.jpg')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              minHeight: '500px',
              display: 'block',
            }}
          />
        </div>
      </div>
    </>
  );
}
