import React from 'react';

interface FuelGaugeProps {
  billable: number;
  nonbillable: number;
  label: string;
}

const FuelGauge: React.FC<FuelGaugeProps> = ({ billable, nonbillable, label }) => {
  const total = billable + nonbillable;
  const billablePercent = total > 0 ? (billable / total) * 100 : 0;
  
  // Angle for the needle (0 to 180, 0 is full nonbillable, 180 is full billable)
  const rotation = (billablePercent / 100) * 180 - 90;

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'monospace' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#ccc' }}>{label}</h3>
      <svg width="240" height="140" viewBox="0 0 240 140">
        {/* Air/Nonbillable Zone (Left) */}
        <path
          d="M 40 120 A 80 80 0 0 1 120 40"
          fill="none"
          stroke="#00bcd4"
          strokeWidth="12"
        />
        {/* Fuel/Billable Zone (Right) */}
        <path
          d="M 120 40 A 80 80 0 0 1 200 120"
          fill="none"
          stroke="#ff9800"
          strokeWidth="12"
        />
        
        {/* Center */}
        <circle cx="120" cy="120" r="6" fill="#fff" />
        
        {/* Needle */}
        <line
          x1="120"
          y1="120"
          x2="120"
          y2="45"
          stroke="#fff"
          strokeWidth="4"
          transform={`rotate(${rotation}, 120, 120)`}
          style={{ transition: 'transform 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
        />

        <text x="50" y="135" fontSize="10" fill="#00bcd4" textAnchor="middle">AIR (NB)</text>
        <text x="190" y="135" fontSize="10" fill="#ff9800" textAnchor="middle">FUEL (B)</text>
        <text x="120" y="30" fontSize="12" fill="#fff" textAnchor="middle" fontWeight="bold">
          {billablePercent.toFixed(0)}% RICH
        </text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
        <div style={{ color: '#ff9800' }}>
          <div style={{ fontSize: '10px' }}>BILLABLE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{billable.toFixed(1)}h</div>
        </div>
        <div style={{ color: '#00bcd4' }}>
          <div style={{ fontSize: '10px' }}>NON-BILLABLE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{nonbillable.toFixed(1)}h</div>
        </div>
      </div>
    </div>
  );
};

export default FuelGauge;
