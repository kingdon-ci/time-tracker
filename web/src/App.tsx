import { useState, useEffect } from 'react'
import './App.css'
import Gauge from './components/Gauge'
import FuelGauge from './components/FuelGauge'

interface ProgressData {
  total_hours: number;
  expected_hours: number;
  percentage: number;
  hours_diff: number;
  status: 'over' | 'under';
  weekdays: number;
  start_date: string;
  end_date: string;
}

interface Entry {
  activity: string;
  duration: string;
  duration_hours: number;
  note: string;
  nonbillable: boolean;
}

interface TrackerData {
  progress: ProgressData;
  entries: Entry[];
  generated_at: string;
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

interface HistoryData {
  months: HistoricalMonth[];
  generated_at: string;
}

type View = 'balance' | 'context';

function App() {
  const [currentData, setCurrentData] = useState<TrackerData | null>(null);
  const [sixData, setSixData] = useState<TrackerData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('balance');

  useEffect(() => {
    Promise.all([
      fetch('/data.json').then(res => res.json()),
      fetch('/six.json').then(res => res.json()),
      fetch('/history_summary.json').then(res => res.json())
    ])
    .then(([current, six, history]) => {
      setCurrentData(current);
      setSixData(six);
      setHistoryData(history);
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading Carburetor...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!currentData || !historyData || !sixData) return <div className="error">No data available</div>;

  const { progress, entries } = currentData;
  
  // Historical context: Go back to Jan 1st of current year OR 6 months ago, whichever is shorter.
  const currentYear = new Date(progress.start_date).getFullYear();
  const historyMonths = historyData.months;
  
  // Filter for months in the current year, then take at most the last 5 to combine with current month
  const relevantHistoricalMonths = historyMonths
    .filter(m => m.year === currentYear)
    .slice(-5);
    
  const historicalDiff = relevantHistoricalMonths.reduce((sum, m) => sum + m.hours_diff, 0);
  const compTimeBalance = historicalDiff + progress.hours_diff;
  const lookbackCount = relevantHistoricalMonths.length + 1;

  const lastThreeMonths = historyData.months.slice(-4, -1).reverse();

  // Calculate billable vs nonbillable for "Make Six"
  const sixBillable = sixData.entries.filter(e => !e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);
  const sixNonBillable = sixData.entries.filter(e => e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);

  return (
    <div className="container">
      <header>
        <div className="header-main">
          <h1>Time Carburetor</h1>
          <nav>
            <button 
              className={view === 'balance' ? 'active' : ''} 
              onClick={() => setView('balance')}
            >
              BILLABLE BALANCE
            </button>
            <button 
              className={view === 'context' ? 'active' : ''} 
              onClick={() => setView('context')}
            >
              WORK CONTEXT
            </button>
          </nav>
        </div>
        <p className="subtitle">{view === 'balance' ? `Rolling Comp Time (Last ${lookbackCount} Months)` : 'Billable/Non-Billable Mixture'}</p>
      </header>

      {view === 'balance' ? (
        <main className="dashboard">
          <div className="left-col">
            <section className="panel gauge-panel">
              <Gauge 
                value={compTimeBalance} 
                min={-80} 
                max={80} 
                label="Rolling Comp Balance" 
                unit="hrs" 
              />
              <div className="stats">
                <div className="stat-item">
                  <label>This Month</label>
                  <span className={progress.hours_diff >= 0 ? 'over' : 'under'}>
                    {progress.hours_diff >= 0 ? '+' : ''}{progress.hours_diff.toFixed(1)}h
                  </span>
                </div>
                <div className="stat-item">
                  <label>{`Prev ${lookbackCount - 1} Mo`}</label>
                  <span className={historicalDiff >= 0 ? 'over' : 'under'}>
                    {historicalDiff >= 0 ? '+' : ''}{historicalDiff.toFixed(1)}h
                  </span>
                </div>
              </div>
            </section>

            <section className="panel status-panel">
              <h3>Monthly Performance</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <label>Target</label>
                  <span>{progress.percentage.toFixed(1)}%</span>
                </div>
                <div className="stat-item">
                  <label>Expected</label>
                  <span>{progress.expected_hours.toFixed(1)}h</span>
                </div>
              </div>
            </section>

            <section className="panel history-panel">
              <h3>History (Last 6)</h3>
              <div className="history-list">
                {historyData.months.slice(-6).reverse().map((m, i) => (
                  <div key={i} className="history-item">
                    <div className="history-date">{m.year}-{String(m.month).padStart(2, '0')}</div>
                    <div className={`history-diff ${m.hours_diff >= 0 ? 'over' : 'under'}`}>
                      {m.hours_diff >= 0 ? '+' : ''}{m.hours_diff.toFixed(1)}h
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="right-col">
            <section className="panel trend-panel">
              <h3>Cumulative Surplus/Deficit (12 Mo)</h3>
              <div className="chart-container">
                <TrendChart months={historyData.months.slice(-12)} />
              </div>
            </section>

            <section className="panel entries-panel">
              <h3>Recent Activity</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Duration</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.filter(e => !e.nonbillable).slice(-10).reverse().map((entry, i) => (
                      <tr key={i}>
                        <td>{entry.activity}</td>
                        <td>{entry.duration}</td>
                        <td className="note-cell">{entry.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      ) : (
        <main className="dashboard context-view">
          <div className="left-col">
            <section className="panel fuel-panel">
              <FuelGauge 
                billable={sixBillable} 
                nonbillable={sixNonBillable} 
                label="Make Six Mixture" 
              />
              <div className="fuel-stats">
                <p>Total time spent working (past 6 days): <strong>{(sixBillable + sixNonBillable).toFixed(1)}h</strong></p>
              </div>
            </section>

            <section className="panel summary-panel">
              <h3>Month at a Glance</h3>
              <div className="mixture-bars">
                {(() => {
                  const b = entries.filter(e => !e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);
                  const nb = entries.filter(e => e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);
                  const total = b + nb;
                  return (
                    <div className="bar-container">
                      <div className="bar billable" style={{ width: `${(b/total)*100}%` }}></div>
                      <div className="bar nonbillable" style={{ width: `${(nb/total)*100}%` }}></div>
                      <div className="bar-labels">
                        <span>Billable: {b.toFixed(1)}h</span>
                        <span>Non-Billable: {nb.toFixed(1)}h</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          </div>

          <div className="right-col">
            <section className="panel entries-panel">
              <h3>All Activity (Billable & Non-Billable)</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Activity</th>
                      <th>Duration</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(-15).reverse().map((entry, i) => (
                      <tr key={i} className={entry.nonbillable ? 'nb-row' : 'b-row'}>
                        <td><span className={`tag ${entry.nonbillable ? 'tag-nb' : 'tag-b'}`}>{entry.nonbillable ? 'NB' : 'B'}</span></td>
                        <td>{entry.activity}</td>
                        <td>{entry.duration}</td>
                        <td className="note-cell">{entry.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      )}

      <footer>
        <p>Last updated: {new Date(currentData.generated_at).toLocaleString()}</p>
        <p>Projected for: {progress.start_date} to {progress.end_date}</p>
      </footer>
    </div>
  )
}

function TrendChart({ months }: { months: HistoricalMonth[] }) {
  const maxDiff = Math.max(...months.map(m => Math.abs(m.hours_diff)), 20);
  const height = 150;
  const width = 600;
  const padding = 30;
  
  const points = months.map((m, i) => {
    const x = padding + (i * (width - 2 * padding) / (months.length - 1 || 1));
    const y = height / 2 - (m.hours_diff / maxDiff) * (height / 2 - padding);
    return { x, y, val: m.hours_diff };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Zero line */}
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#444" strokeDasharray="4 2" />
      
      {/* Grid lines */}
      <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#222" />
      <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#222" />

      {/* The path */}
      <path d={pathD} fill="none" stroke="#4caf50" strokeWidth="2" />
      
      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.val >= 0 ? '#4caf50' : '#f44336'} />
      ))}

      {/* Labels for latest month */}
      {points.length > 0 && (
        <text x={points[points.length-1].x} y={points[points.length-1].y - 10} fill="#fff" fontSize="10" textAnchor="middle">
          {points[points.length-1].val.toFixed(1)}
        </text>
      )}
    </svg>
  );
}

export default App
