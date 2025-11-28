'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * LOGIN PAGE - SIMPLE & SECURE
 * 
 * Pour tester, utilise le token JWT fourni
 */

export default function LoginPage() {
  const [token, setToken] = useState('');
  const { login } = useAuthStore();

  const handleLogin = () => {
    if (token.trim()) {
      // Mock user pour le test
      const mockUser = {
        id: '494228d9-a762-4e36-ac83-16f872ee54eb',
        email: 'charlie.coupe59@gmail.com',
        supabase_id: '494228d9-a762-4e36-ac83-16f872ee54eb',
        created_at: new Date().toISOString(),
      };
      
      login(token, mockUser);
      window.location.href = '/dashboard';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom right, #0a0a0f, #1a1a2e)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        background: '#1a1a2e',
        borderRadius: '12px',
        border: '1px solid #333',
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          background: 'linear-gradient(to right, #10b981, #3b82f6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          SENTRYAL
        </h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>
          Login to access your dashboard
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: '#888',
            fontSize: '0.875rem',
          }}>
            JWT Token
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your JWT token here..."
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#0a0a0f',
              border: '1px solid #333',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              resize: 'vertical',
              minHeight: '100px',
            }}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={!token.trim()}
          style={{
            width: '100%',
            padding: '1rem',
            background: token.trim() 
              ? 'linear-gradient(to right, #10b981, #3b82f6)' 
              : '#333',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: token.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Login
        </button>

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#0a0a0f',
          borderRadius: '8px',
          border: '1px solid #333',
        }}>
          <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
            💡 Pour tester, utilise le token fourni
          </p>
          <p style={{ fontSize: '0.75rem', color: '#666' }}>
            Le token sera stocké dans localStorage et utilisé pour toutes les requêtes API
          </p>
        </div>
      </div>
    </div>
  );
}
