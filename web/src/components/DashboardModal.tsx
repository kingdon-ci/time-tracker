import React from 'react';
import './DashboardModal.css';

interface Entry {
  activity: string;
  duration: string;
  duration_hours: number;
  note: string;
  nonbillable: boolean;
  date?: string;
}

interface HistoricalMonth {
  year: number;
  month: number;
  total_hours: number;
  expected_hours: number;
  hours_diff: number;
  percentage: number;
  weekdays: number;
  moving_avg_4m: number | null;
}

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'pacing' | 'bank' | 'energy' | 'history';
  data: {
    entries: Entry[];
    progress: any;
    sixData?: any;
    historyData?: any;
    selectedMonth?: HistoricalMonth;
  };
}

const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose, title, type, data }) => {
  if (!isOpen) return null;

  const renderPacingRoom = () => {
    // Calculate billable statistics
    const billableEntries = data.entries.filter(e => !e.nonbillable);
    const nonBillableEntries = data.entries.filter(e => e.nonbillable);
    
    const currentBillableHours = billableEntries.reduce((sum, e) => sum + e.duration_hours, 0);
    const expectedHours = data.progress.expected_hours;
    const performance = expectedHours > 0 ? (currentBillableHours / expectedHours) * 100 : 0;
    const billableDiff = currentBillableHours - expectedHours;

    // Group entries by activity to see where time goes
    const billableTotals = billableEntries.reduce((acc: any, entry) => {
      acc[entry.activity] = (acc[entry.activity] || 0) + entry.duration_hours;
      return acc;
    }, {});
    const sortedBillable = Object.entries(billableTotals)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    const nonBillableTotals = nonBillableEntries.reduce((acc: any, entry) => {
      acc[entry.activity] = (acc[entry.activity] || 0) + entry.duration_hours;
      return acc;
    }, {});
    const sortedNonBillable = Object.entries(nonBillableTotals)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    const maxHours = Math.max(
      (sortedBillable[0]?.[1] as number) || 0,
      (sortedNonBillable[0]?.[1] as number) || 0
    );

    return (
      <div className="pacing-room">
        <div className="detail-grid">
          <div className="detail-card highlight">
            <h3>Status Report (Billable)</h3>
            <div className="big-stat">
              <span className="value">{performance.toFixed(1)}%</span>
              <span className="label">Monthly Target</span>
            </div>
            <p>You are currently <strong>{Math.abs(billableDiff).toFixed(1)}h</strong> {billableDiff >= 0 ? 'ahead of' : 'behind'} schedule.</p>
            <div className="stats mini" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-around', color: '#888' }}>
              <div><span>Expected:</span> <strong style={{color:'#ddd'}}>{expectedHours.toFixed(1)}h</strong></div>
              <div><span>Actual:</span> <strong style={{color:'#ddd'}}>{currentBillableHours.toFixed(1)}h</strong></div>
            </div>
          </div>
          
          <div className="detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Activity Breakdown</h3>
            <div className="activity-list" style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', paddingRight: '10px' }}>
              <div style={{ color: '#3498db', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>Billable Work</div>
              {sortedBillable.map(([name, hours]: any) => (
                <div key={name} className="activity-row">
                  <span className="name">{name}</span>
                  <div className="bar-container">
                    <div 
                      className="bar" 
                      style={{ width: `${(hours / maxHours) * 100}%` }}
                    ></div>
                  </div>
                  <span className="hours">{hours.toFixed(1)}h</span>
                </div>
              ))}
              
              {sortedNonBillable.length > 0 && (
                <>
                  <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', margin: '1rem 0 0.5rem 0', letterSpacing: '1px' }}>Non-Billable Work</div>
                  {sortedNonBillable.map(([name, hours]: any) => (
                    <div key={name} className="activity-row">
                      <span className="name" style={{ color: '#aaa' }}>{name}</span>
                      <div className="bar-container">
                        <div 
                          className="bar" 
                          style={{ width: `${(hours / maxHours) * 100}%`, background: '#666' }}
                        ></div>
                      </div>
                      <span className="hours" style={{ color: '#aaa' }}>{hours.toFixed(1)}h</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="detail-card full-width">
          <h3>Recent Log Stream</h3>
          <div className="log-table-container">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Hours</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.slice(0, 15).map((entry, i) => (
                  <tr key={i} className={entry.nonbillable ? 'non-billable' : ''}>
                    <td>
                      {entry.activity}
                      {entry.nonbillable && <span style={{marginLeft: '8px', fontSize: '0.7em', padding: '2px 4px', background: '#333', borderRadius: '3px'}}>NB</span>}
                    </td>
                    <td>{entry.duration_hours.toFixed(2)}h</td>
                    <td className="note-cell">{entry.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderBankVault = () => {
    const historyMonths = data.historyData?.months || [];
    if (historyMonths.length === 0) return <div className="system-msg">No historical data available.</div>;
    
    // Calculate simple stats
    const totalDiff = historyMonths.reduce((sum: number, m: any) => sum + m.hours_diff, 0);
    const bestMonth = [...historyMonths].sort((a, b) => b.hours_diff - a.hours_diff)[0];
    const restMonth = [...historyMonths].sort((a, b) => a.hours_diff - b.hours_diff)[0];
    
    return (
      <div className="bank-vault">
        <div className="history-card">
          <div className="history-stat">
            <span className={`val ${totalDiff >= 0 ? 'pos' : 'neg'}`}>{totalDiff >= 0 ? '+' : ''}{totalDiff.toFixed(1)}h</span>
            <span className="lbl">All-Time Delta</span>
          </div>
          <div className="history-stat">
            <span className="val">{historyMonths.length}</span>
            <span className="lbl">Months Tracked</span>
          </div>
          <div className="history-stat">
            <span className="val pos">+{bestMonth?.hours_diff.toFixed(1)}h</span>
            <span className="lbl">Best Mo. ({bestMonth?.year}-{String(bestMonth?.month).padStart(2, '0')})</span>
          </div>
          <div className="history-stat">
            <span className="val neg">{restMonth?.hours_diff.toFixed(1)}h</span>
            <span className="lbl">Rest Mo. ({restMonth?.year}-{String(restMonth?.month).padStart(2, '0')})</span>
          </div>
        </div>

        <div className="detail-card full-width">
          <h3>Historical Ledger (All-Time)</h3>
          <div className="log-table-container">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Delta</th>
                  <th>Total Hours</th>
                  <th>Expected</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {[...historyMonths].reverse().map((m: any, i) => (
                  <tr key={i}>
                    <td>{m.year}-{String(m.month).padStart(2, '0')}</td>
                    <td className={m.hours_diff >= 0 ? 'pos' : 'neg'} style={{color: m.hours_diff >= 0 ? '#2ecc71' : '#e74c3c'}}>
                      {m.hours_diff >= 0 ? '+' : ''}{m.hours_diff.toFixed(1)}h
                    </td>
                    <td>{m.total_hours.toFixed(1)}h</td>
                    <td>{m.expected_hours.toFixed(1)}h</td>
                    <td>{m.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEnergyLab = () => {
    const sixEntries = data.sixData?.entries || [];
    const billable = sixEntries.filter((e: any) => !e.nonbillable);
    const nonBillable = sixEntries.filter((e: any) => e.nonbillable);
    
    const bHours = billable.reduce((s: number, e: any) => s + e.duration_hours, 0);
    const nbHours = nonBillable.reduce((s: number, e: any) => s + e.duration_hours, 0);
    const total = bHours + nbHours;
    
    // Group Non-Billable by Activity
    const nbTotals = nonBillable.reduce((acc: any, entry: any) => {
      acc[entry.activity] = (acc[entry.activity] || 0) + entry.duration_hours;
      return acc;
    }, {});
    
    const sortedNb = Object.entries(nbTotals).sort(([, a], [, b]) => (b as number) - (a as number));

    return (
      <div className="energy-lab">
        <div className="detail-grid">
          <div className="detail-card highlight">
            <h3>6-Day Mixture Analysis</h3>
            <div className="big-stat">
              <span className="value" style={{color: '#3498db'}}>{total > 0 ? ((bHours / total) * 100).toFixed(0) : 0}%</span>
              <span className="label">Billable Density</span>
            </div>
            <div className="stats mini" style={{ display: 'flex', justifyContent: 'space-around', color: '#888' }}>
              <div><span>Billable:</span> <strong style={{color:'#3498db'}}>{bHours.toFixed(1)}h</strong></div>
              <div><span>Non-Billable:</span> <strong style={{color:'#9b59b6'}}>{nbHours.toFixed(1)}h</strong></div>
            </div>
          </div>
          
          <div className="detail-card">
            <h3>Non-Billable Investments</h3>
            <div className="activity-list">
              {sortedNb.map(([name, hours]: any) => (
                <div key={name} className="activity-row">
                  <span className="name" style={{ color: '#aaa' }}>{name}</span>
                  <div className="bar-container">
                    <div 
                      className="bar" 
                      style={{ width: `${(hours / (nbHours || 1)) * 100}%`, background: '#9b59b6' }}
                    ></div>
                  </div>
                  <span className="hours" style={{ color: '#aaa' }}>{hours.toFixed(1)}h</span>
                </div>
              ))}
              {sortedNb.length === 0 && <div className="system-msg" style={{marginTop: '2rem', textAlign: 'center'}}>No non-billable investments recorded.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryRoom = () => {
    const month = data.selectedMonth;
    if (!month) return <div className="system-msg">No month selected.</div>;

    return (
      <div className="history-room">
        <div className="history-card">
          <div className="history-stat" style={{ borderColor: month.hours_diff >= 0 ? '#2ecc71' : '#e74c3c' }}>
            <span className={`val ${month.hours_diff >= 0 ? 'pos' : 'neg'}`}>{month.hours_diff >= 0 ? '+' : ''}{month.hours_diff.toFixed(1)}h</span>
            <span className="lbl">Delta</span>
          </div>
          <div className="history-stat">
            <span className="val" style={{color: '#3498db'}}>{month.percentage.toFixed(1)}%</span>
            <span className="lbl">Performance</span>
          </div>
          <div className="history-stat">
            <span className="val">{month.total_hours.toFixed(1)}h</span>
            <span className="lbl">Total Hours</span>
          </div>
          <div className="history-stat">
            <span className="val">{month.expected_hours.toFixed(1)}h</span>
            <span className="lbl">Expected ({month.weekdays} days)</span>
          </div>
        </div>
        <div className="detail-card">
           <h3 style={{marginBottom: 0}}>4-Month Moving Average</h3>
           <div className="big-stat" style={{marginTop: '1rem'}}>
             <span className="value" style={{fontSize: '2.5rem', color: '#aaa'}}>{month.moving_avg_4m ? `${month.moving_avg_4m >= 0 ? '+' : ''}${month.moving_avg_4m.toFixed(2)}h` : 'N/A'}</span>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </header>
        <div className="modal-body">
          {type === 'pacing' && renderPacingRoom()}
          {type === 'bank' && renderBankVault()}
          {type === 'energy' && renderEnergyLab()}
          {type === 'history' && renderHistoryRoom()}
        </div>
        <footer className="modal-footer">
          <span className="system-msg">SYSTEM::DIAGNOSTIC_MODE_ACTIVE</span>
        </footer>
      </div>
    </div>
  );
};

export default DashboardModal;
