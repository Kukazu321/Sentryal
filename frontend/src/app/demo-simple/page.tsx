'use client';

import { useState, useEffect } from 'react';

/**
 * DEMO SIMPLE - TEST RAPIDE
 * Version simplifiée sans WebGL pour tester que tout fonctionne
 */

export default function DemoSimplePage() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [pointCount, setPointCount] = useState(1000);
  const [points, setPoints] = useState<Array<{ x: number; y: number; value: number }>>([]);

  // Test backend
  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then(res => res.json())
      .then(data => setBackendStatus(`✅ Backend OK (uptime: ${Math.round(data.uptime)}s)`))
      .catch(() => setBackendStatus('❌ Backend offline'));
  }, []);

  // Générer des points
  const generatePoints = () => {
    const newPoints = [];
    for (let i = 0; i < pointCount; i++) {
      newPoints.push({
        x: Math.random() * 800,
        y: Math.random() * 400,
        value: Math.random() * 100 - 50,
      });
    }
    setPoints(newPoints);
  };

  useEffect(() => {
    generatePoints();
  }, [pointCount]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom right, #1a1a2e, #0f0f1e)',
      color: 'white',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{ 
        borderBottom: '1px solid #333',
        paddingBottom: '1rem',
        marginBottom: '2rem'
      }}>
        <h1 style={{ 
          fontSize: '2rem',
          fontWeight: 'bold',
          background: 'linear-gradient(to right, #10b981, #3b82f6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          SENTRYAL - Demo Simple
        </h1>
        <p style={{ color: '#888' }}>
          Test rapide des performances
        </p>
      </div>

      {/* Status */}
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Status</h2>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <div style={{ color: '#888', fontSize: '0.875rem' }}>Backend</div>
            <div style={{ fontSize: '1.125rem', color: '#10b981' }}>{backendStatus}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '0.875rem' }}>Frontend</div>
            <div style={{ fontSize: '1.125rem', color: '#10b981' }}>✅ Running</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '0.875rem' }}>Points</div>
            <div style={{ fontSize: '1.125rem', color: '#3b82f6' }}>{points.length.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Controls</h2>
        <div>
          <label style={{ display: 'block', color: '#888', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Point Count: {pointCount.toLocaleString()}
          </label>
          <input
            type="range"
            min="100"
            max="10000"
            step="100"
            value={pointCount}
            onChange={(e) => setPointCount(parseInt(e.target.value))}
            style={{ width: '100%', height: '8px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
            <span>100</span>
            <span>5k</span>
            <span>10k</span>
          </div>
        </div>
        <button
          onClick={generatePoints}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(to right, #10b981, #3b82f6)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Regenerate Points
        </button>
      </div>

      {/* Visualization */}
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Visualization (Canvas 2D)</h2>
        <svg width="800" height="400" style={{ background: '#0a0a0f', borderRadius: '4px' }}>
          {/* Grid */}
          {[...Array(10)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1="0"
              y1={i * 40}
              x2="800"
              y2={i * 40}
              stroke="#1a1a2e"
              strokeWidth="1"
            />
          ))}
          {[...Array(20)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * 40}
              y1="0"
              x2={i * 40}
              y2="400"
              stroke="#1a1a2e"
              strokeWidth="1"
            />
          ))}
          
          {/* Points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="2"
              fill={point.value > 0 ? '#10b981' : '#ef4444'}
              opacity="0.6"
            />
          ))}
        </svg>
        
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.875rem' }}>
          <div style={{ background: '#0a0a0f', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>
            <div style={{ color: '#888' }}>Rendering</div>
            <div style={{ fontSize: '1.125rem', color: '#10b981' }}>SVG</div>
          </div>
          <div style={{ background: '#0a0a0f', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>
            <div style={{ color: '#888' }}>Points</div>
            <div style={{ fontSize: '1.125rem', color: '#3b82f6' }}>{points.length}</div>
          </div>
          <div style={{ background: '#0a0a0f', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>
            <div style={{ color: '#888' }}>Performance</div>
            <div style={{ fontSize: '1.125rem', color: '#a855f7' }}>Instant</div>
          </div>
          <div style={{ background: '#0a0a0f', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>
            <div style={{ color: '#888' }}>Status</div>
            <div style={{ fontSize: '1.125rem', color: '#10b981' }}>✅ OK</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: '2rem',
        paddingTop: '1rem',
        borderTop: '1px solid #333',
        textAlign: 'center',
        color: '#666',
        fontSize: '0.875rem'
      }}>
        <p>
          SENTRYAL • Demo Simple • <span style={{ color: '#10b981' }}>Tout fonctionne parfaitement</span>
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          Pour la version complète avec WebGL, voir <code style={{ background: '#1a1a2e', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>/demo</code>
        </p>
      </div>
    </div>
  );
}
