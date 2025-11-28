'use client';

import React, { useEffect, useRef } from 'react';

/**
 * PerformanceChart - VERSION SIMPLE SANS ERREURS
 * Graphique time-series avec Canvas
 */

interface DataPoint {
  date: string;
  value: number;
  min?: number;
  max?: number;
}

interface PerformanceChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  lineColor?: string;
  fillColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  aggregation?: 'none' | 'day' | 'week' | 'month';
  onDataPointClick?: (point: DataPoint) => void;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  width = 800,
  height = 400,
  lineColor = '#00ff00',
  fillColor = '#00ff00',
  gridColor = '#333',
  showGrid = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      
      for (let i = 0; i <= 10; i++) {
        const y = (height / 10) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      for (let i = 0; i <= 20; i++) {
        const x = (width / 20) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Calculate bounds
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    // Draw line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = (width / (data.length - 1)) * i;
      const y = height - ((point.value - minValue) / range) * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = lineColor;
    data.forEach((point, i) => {
      const x = (width / (data.length - 1)) * i;
      const y = height - ((point.value - minValue) / range) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

  }, [data, width, height, lineColor, gridColor, showGrid]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ cursor: 'crosshair', borderRadius: '4px' }}
      />
    </div>
  );
};

export default PerformanceChart;
