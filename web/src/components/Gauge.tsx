import React from 'react';

interface GaugeProps {
  value: number; // Current hours balance (e.g. -5 to +5)
  min: number;   // Min value on gauge
  max: number;   // Max value on gauge
  label: string;
  unit: string;
}

const Gauge: React.FC<GaugeProps> = ({ value, min, max, label, unit }) => {
  // Map value to rotation (0 to 180 degrees)
  const clampedValue = Math.min(Math.max(value, min), max);
  const range = max - min;
  const normalized = (clampedValue - min) / range;
  const rotation = normalized * 180 - 90; // -90 to 90 degrees

  // Colors based on value
  const getColor = () => {
    if (value > 0) return '#4caf50'; // Green (Over / Banking)
    if (value < 0) return '#f44336'; // Red (Under / Deficit)
    return '#ffeb3b'; // Yellow (Balanced)
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'monospace' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#ccc' }}>{label}</h3>
      <svg width="100%" height="100%" viewBox="0 0 200 120" style={{ maxWidth: '200px' }}>
        {/* Background Arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#333"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value Arc (Colored) */}
        <path
          d="M 100 100 L 20 100 A 80 80 0 0 1 180 100 Z"
          fill="none"
        />
        
        {/* Center Point */}
        <circle cx="100" cy="100" r="5" fill="#fff" />
        
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="30"
          stroke={getColor()}
          strokeWidth="3"
          transform={`rotate(${rotation}, 100, 100)`}
          style={{ transition: 'transform 1s ease-out' }}
        />
        
        {/* Labels */}
        <text x="20" y="115" fontSize="10" fill="#666" textAnchor="middle">{min}</text>
        <text x="100" y="115" fontSize="10" fill="#666" textAnchor="middle">0</text>
        <text x="180" y="115" fontSize="10" fill="#666" textAnchor="middle">{max}</text>
      </svg>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '10px', color: getColor() }}>
        {value > 0 ? '+' : ''}{value.toFixed(1)} {unit}
      </div>
    </div>
  );
};

export default Gauge;
