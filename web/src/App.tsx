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

function App() {
  const [currentData, setCurrentData] = useState<TrackerData | null>(null);
  const [sixData, setSixData] = useState<TrackerData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  
  // Calculate BILLABLE only for current month to match historical data
  const currentBillableHours = entries
    .filter(e => !e.nonbillable)
    .reduce((sum, e) => sum + e.duration_hours, 0);
  
  const currentBillableDiff = currentBillableHours - progress.expected_hours;

  // Historical context: Go back to Jan 1st of current year OR 6 months ago, whichever is shorter.
  const currentYear = new Date(progress.start_date).getFullYear();
  const historyMonths = historyData.months;
  
  // Filter for months in the current year, then take at most the last 5 to combine with current month
  const relevantHistoricalMonths = historyMonths
    .filter(m => m.year === currentYear)
    .slice(-5);
    
  const historicalDiff = relevantHistoricalMonths.reduce((sum, m) => sum + m.hours_diff, 0);
  const compTimeBalance = historicalDiff + currentBillableDiff;
  const lookbackCount = relevantHistoricalMonths.length + 1;

  // Calculate billable vs nonbillable for "Make Six"
  const sixBillable = sixData.entries.filter(e => !e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);
  const sixNonBillable = sixData.entries.filter(e => e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);

  // Calculate billable vs nonbillable for this month
  const monthNonBillable = entries.filter(e => e.nonbillable).reduce((sum, e) => sum + e.duration_hours, 0);

  return (
    <div className="container">
      <header>
        <div className="header-main">
          <h1>Time Carburetor</h1>
          <div className="header-stats">
            <span className="balance-badge">
              Rolling Comp: <strong>{compTimeBalance >= 0 ? '+' : ''}{compTimeBalance.toFixed(1)}h</strong>
            </span>
          </div>
        </div>
        <p className="subtitle">Rolling Billable Balance (Last {lookbackCount} Mo) & Work Context</p>
      </header>

      <main className="dashboard main-view">
        <div className="left-col">
          {/* Gauge 1: Billable Balance */}
          <section className="panel gauge-panel">
            <Gauge 
              value={compTimeBalance} 
              min={-80} 
              max={80} 
              label="Rolling Billable Balance" 
              unit="hrs" 
            />
            <div className="stats">
              <div className="stat-item">
                <label>Billable This Mo</label>
                <span className={currentBillableDiff >= 0 ? 'over' : 'under'}>
                  {currentBillableDiff >= 0 ? '+' : ''}{currentBillableDiff.toFixed(1)}h
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

          {/* Gauge 2: Fuel Mixture (Past 6 Days) */}
          <section className="panel fuel-panel">
            <FuelGauge 
              billable={sixBillable} 
              nonbillable={sixNonBillable} 
              label="Make Six Mixture" 
            />
            <div className="fuel-stats">
              <p>Work Intensity (6d): <strong>{(sixBillable + sixNonBillable).toFixed(1)}h</strong></p>
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
            <div className="panel-header">
              <h3>Recent Activity</h3>
              <div className="month-mixture">
                <span className="mixture-label">Month Mixture:</span>
                <div className="mini-bar">
                  <div className="bar billable" style={{ width: `${(currentBillableHours/(currentBillableHours+monthNonBillable))*100}%` }}></div>
                  <div className="bar nonbillable" style={{ width: `${(monthNonBillable/(currentBillableHours+monthNonBillable))*100}%` }}></div>
                </div>
              </div>
            </div>
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

      <footer>
        <div className="footer-info">
          <p>Last updated: {new Date(currentData.generated_at).toLocaleString()}</p>
          <p>Historical data assumes "Billable Only" (matching `history/` CSVs)</p>
        </div>
        <div className="footer-range">
          <p>Current range: {progress.start_date} to {progress.end_date}</p>
        </div>
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
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#444" strokeDasharray="4 2" />
      <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#222" />
      <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#222" />
      <path d={pathD} fill="none" stroke="#4caf50" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.val >= 0 ? '#4caf50' : '#f44336'} />
      ))}
      {points.length > 0 && (
        <text x={points[points.length-1].x} y={points[points.length-1].y - 10} fill="#fff" fontSize="10" textAnchor="middle">
          {points[points.length-1].val.toFixed(1)}
        </text>
      )}
    </svg>
  );
}

export default App
