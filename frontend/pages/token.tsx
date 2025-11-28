import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthContext } from '../context/AuthProvider';

export default function TokenPage() {
  const { user, session, loading } = useAuthContext();
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      // Si pas connecté, rediriger vers login
      router.replace('/auth/login');
    } else if (session?.access_token) {
      // Récupérer le token depuis la session
      setToken(session.access_token);
    }
  }, [user, session, loading, router]);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  if (!user) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        width: '100%',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#2e7d32',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          ✅ Connexion Réussie
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          Voici votre token JWT d'authentification
        </p>

        <div style={{
          marginBottom: '24px',
          padding: '24px',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          border: '2px solid #4caf50'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#2e7d32',
            marginBottom: '12px'
          }}>
            🎉 JWT Token:
          </div>
          
          <textarea
            readOnly
            value={token || 'Token not found'}
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '16px',
              border: '1px solid #4caf50',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'monospace',
              backgroundColor: 'white',
              resize: 'vertical',
              wordBreak: 'break-all',
              lineHeight: '1.5'
            }}
            onClick={(e) => {
              (e.target as HTMLTextAreaElement).select();
            }}
          />
          
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '16px'
          }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: copied ? '#4caf50' : '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {copied ? '✅ Copié !' : '📋 Copier le Token'}
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              → Aller au Dashboard
            </button>
          </div>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#856404'
        }}>
          <strong>💡 Info:</strong> Ce token est valide pendant 60 jours. Utilisez-le pour les requêtes API.
        </div>
      </div>
    </div>
  );
}
