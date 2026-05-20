import { useState, useEffect } from 'react'
import './App.css'
import Gauge from './components/Gauge'
import DashboardModal from './components/DashboardModal'

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
  date?: string;
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

interface GroqData {
  todayTotal: number;
  thisMonthTotal: number;
  lastMonthTotal: number;
  generated_at?: string;
}

function App() {
  const [currentData, setCurrentData] = useState<TrackerData | null>(null);
  const [sixData, setSixData] = useState<TrackerData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [groqData, setGroqData] = useState<GroqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<{ type: 'pacing' | 'bank' | 'energy' | 'history', data?: any } | null>(null);
  const [trendView, setTrendView] = useState<'monthly' | 'daily'>('monthly');

  useEffect(() => {
    const fetchData = async (url: string, fallback: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Fetch to ${url} failed with status ${response.status}, falling back to ${fallback}`);
          const fallbackRes = await fetch(fallback);
          return await fallbackRes.json();
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn(`Fetch to ${url} returned HTML instead of JSON, falling back to ${fallback}`);
          const fallbackRes = await fetch(fallback);
          return await fallbackRes.json();
        }
        
        return await response.json();
      } catch (e) {
        console.error(`Error fetching ${url}, falling back to ${fallback}:`, e);
        try {
          const fallbackRes = await fetch(fallback);
          return await fallbackRes.json();
        } catch (fallbackError) {
          console.error(`Fallback to ${fallback} also failed:`, fallbackError);
          throw fallbackError;
        }
      }
    };

    Promise.all([
      fetchData('/api/data', '/data.json'),
      fetchData('/api/six', '/six.json'),
      fetchData('/api/history', '/history_summary.json'),
      fetchData('/api/groq', '/groq_summary.json')
    ])
    .then(([current, six, history, groq]) => {
      setCurrentData(current);
      setSixData(six);
      setHistoryData(history);
      setGroqData(groq);
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading Carburetor...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!currentData || !historyData || !sixData) return <div className="error">No data available</div>;

  const { progress, entries } = currentData;
  
  // Calculate BILLABLE only for current month
  const currentBillableHours = entries
    .filter(e => !e.nonbillable)
    .reduce((sum, e) => sum + e.duration_hours, 0);
  
  const currentBillableDiff = currentBillableHours - progress.expected_hours;

  // Historical context
  const [startYear, startMonth] = progress.start_date.split('-').map(Number);
  const currentYear = startYear;
  const historyMonths = historyData?.months || [];
  
  const relevantHistoricalMonths = historyMonths
    .filter(m => m.year === currentYear)
    .slice(-5);
    
  const historicalDiff = relevantHistoricalMonths.reduce((sum, m) => sum + m.hours_diff, 0);
  const compTimeBalance = historicalDiff + currentBillableDiff;
  const lookbackCount = relevantHistoricalMonths.length + 1;

  // Calculate billable vs nonbillable for this month
  const monthNonBillable = entries.filter((e: any) => e.nonbillable).reduce((sum: number, e: any) => sum + e.duration_hours, 0);

  // Daily processing for current month
  const dailyEntries = entries.reduce((acc: any, e) => {
    if (!e.date) return acc;
    if (!acc[e.date]) acc[e.date] = { billable: 0, nonbillable: 0 };
    if (e.nonbillable) acc[e.date].nonbillable += e.duration_hours;
    else acc[e.date].billable += e.duration_hours;
    return acc;
  }, {});

  const isWorkday = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    return day !== 0 && day !== 6;
  };

  const [sY, sM, sD] = progress.start_date.split('-').map(Number);
  const [eY, eM, eD] = progress.end_date.split('-').map(Number);
  const startDate = new Date(sY, sM - 1, sD);
  const endDate = new Date(eY, eM - 1, eD);
  
  const dailyHistory: any[] = [];
  let runningBalance = 0;
  let currDateObj = new Date(startDate);
  // Use a more robust way to get today's date in local time for comparison
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  while (currDateObj <= endDate) {
    // Format current date object to YYYY-MM-DD local
    const dStr = `${currDateObj.getFullYear()}-${String(currDateObj.getMonth() + 1).padStart(2, '0')}-${String(currDateObj.getDate()).padStart(2, '0')}`;
    
    const dayData = dailyEntries[dStr] || { billable: 0, nonbillable: 0 };
    const expected = isWorkday(dStr) ? 8 : 0;
    
    runningBalance += dayData.billable - expected;
    
    dailyHistory.push({
      date: dStr,
      billable: dayData.billable,
      expected: expected,
      hours_diff: runningBalance,
      label: dStr.split('-')[2] // Just the day number
    });
    
    if (dStr === todayStr) break;
    currDateObj.setDate(currDateObj.getDate() + 1);
  }

  return (
    <div className="container">
      <header>
        <div className="header-main">
          <h1>Time Carburetor</h1>
          <div className="header-stats">
            {groqData && (
              <span 
                className={`balance-badge groq-badge ${groqData.todayTotal >= 0.03 ? 'pos' : 'neg'}`}
                title={`Groq Spend:\nToday: $${groqData.todayTotal.toFixed(2)}\nThis Month: $${groqData.thisMonthTotal.toFixed(2)}\nLast Month: $${groqData.lastMonthTotal.toFixed(2)}`}
              >
                Groq: <strong>${groqData.todayTotal.toFixed(2)}</strong>
              </span>
            )}
            <span className="balance-badge">
              Monthly: <strong>{currentBillableDiff >= 0 ? '+' : ''}{currentBillableDiff.toFixed(1)}h</strong>
            </span>
          </div>
        </div>
        <p className="subtitle">Real-time Performance & Historical Comp Balance</p>
      </header>

      <main className="dashboard main-view">
        <div className="left-col">
          {/* Gauge 1: Monthly Balance (Primary) */}
          <section className="panel gauge-panel highlight" onClick={() => setActiveModal({ type: 'pacing' })}>
            <Gauge 
              value={currentBillableDiff} 
              min={-40} 
              max={40} 
              label="Monthly Billable Balance" 
              unit="hrs" 
            />
            <div className="stats">
              <div className="stat-item">
                <label>Billable</label>
                <span>{currentBillableHours.toFixed(1)}h</span>
              </div>
              <div className="stat-item">
                <label>Expected</label>
                <span>{progress.expected_hours.toFixed(1)}h</span>
              </div>
              <div className="stat-item">
                <label>Performance</label>
                <span>{((currentBillableHours / progress.expected_hours) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </section>

          {/* Gauge 2: Rolling Comp Balance */}
          <section className="panel gauge-panel small" onClick={() => setActiveModal({ type: 'bank' })}>
            <Gauge 
              value={compTimeBalance} 
              min={-80} 
              max={80} 
              label={`Rolling Comp (Last ${lookbackCount})`} 
              unit="hrs" 
            />
            <div className="stats mini">
              <div className="stat-item">
                <label>YTD History</label>
                <span className={historicalDiff >= 0 ? 'over' : 'under'}>
                  {historicalDiff >= 0 ? '+' : ''}{historicalDiff.toFixed(1)}h
                </span>
              </div>
            </div>
          </section>

          {/* Gauge 3: Fuel Mixture (Past 6 Days) */}
          <section className="panel fuel-panel" onClick={() => setActiveModal({ type: 'energy' })}>
            <MixtureChart 
              entries={sixData.entries} 
              label="Make Six Mixture" 
            />
          </section>
        </div>

        <div className="right-col">
          <section className="panel trend-panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, border: 'none' }}>{trendView === 'monthly' ? 'Cumulative Surplus/Deficit (All-Time)' : 'Daily Performance Balance (Current Month)'}</h3>
              <div className="toggle-group" style={{ display: 'flex', gap: '5px', background: '#333', padding: '3px', borderRadius: '5px' }}>
                <button 
                  onClick={() => setTrendView('monthly')}
                  style={{ 
                    padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: '3px',
                    background: trendView === 'monthly' ? '#4caf50' : 'transparent',
                    color: trendView === 'monthly' ? '#fff' : '#888',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >MONTHLY</button>
                <button 
                  onClick={() => setTrendView('daily')}
                  style={{ 
                    padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: '3px',
                    background: trendView === 'daily' ? '#4caf50' : 'transparent',
                    color: trendView === 'daily' ? '#fff' : '#888',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >DAILY</button>
              </div>
            </div>
            <div className="chart-container" style={{cursor: 'pointer'}}>
              {trendView === 'monthly' ? (
                <TrendChart 
                  months={[
                    ...historyData.months,
                    {
                      year: startYear,
                      month: startMonth,
                      hours_diff: currentBillableDiff,
                      total_hours: currentBillableHours,
                      expected_hours: progress.expected_hours,
                      percentage: (currentBillableHours / progress.expected_hours) * 100,
                      weekdays: progress.weekdays,
                      moving_avg_4m: null
                    }
                  ]} 
                  onPointClick={(m: any) => setActiveModal({ type: 'history', data: m })} 
                />
              ) : (
                <DailyTrendChart data={dailyHistory} />
              )}
            </div>
          </section>

          <section className="panel entries-panel">
            <div className="panel-header">
              <h3>Activity Stream</h3>
              <div className="month-mixture">
                <span className="mixture-label">B/NB Split:</span>
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
          <p>Expectation based on 8h/weekday up to current date.</p>
        </div>
      </footer>

      <DashboardModal 
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        type={activeModal?.type || 'pacing'}
        title={
          activeModal?.type === 'pacing' ? 'The Pacing Room' :
          activeModal?.type === 'bank' ? 'The Bank Vault' :
          activeModal?.type === 'history' ? `Historical Record: ${activeModal.data?.year}-${String(activeModal.data?.month).padStart(2, '0')}` :
          'The Energy Lab'
        }
        data={{
          entries: entries,
          progress: progress,
          historyData: historyData,
          sixData: sixData,
          selectedMonth: activeModal?.data
        }}
      />
    </div>
  );
  }

  function DailyTrendChart({ data }: { data: any[] }) {
  const maxDiff = Math.max(...data.map(d => Math.abs(d.hours_diff)), 8);
  const height = 150;
  const width = 600;
  const padding = 30;

  const points = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding) / (data.length - 1 || 1));
    const y = height / 2 - (d.hours_diff / maxDiff) * (height / 2 - padding);
    return { x, y, val: d.hours_diff, label: d.label, billable: d.billable, expected: d.expected };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  return (
    <div className="daily-chart-wrapper">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#444" strokeDasharray="4 2" />

        {/* Fill area under/above the line */}
        <path 
          d={`${pathD} L ${points[points.length-1].x} ${height/2} L ${points[0].x} ${height/2} Z`} 
          fill="url(#gradient-daily)" 
          opacity="0.2" 
        />

        <defs>
          <linearGradient id="gradient-daily" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4caf50" />
            <stop offset="50%" stopColor="transparent" />
            <stop offset="100%" stopColor="#f44336" />
          </linearGradient>
        </defs>

        <path d={pathD} fill="none" stroke="#3498db" strokeWidth="2" />

        {points.map((p, i) => (
          <g key={i}>
            <circle 
              cx={p.x} 
              cy={p.y} 
              r={i === points.length - 1 ? "5" : "3"} 
              fill={p.val >= 0 ? '#4caf50' : '#f44336'} 
              style={{ transition: 'all 0.3s' }}
            >
              <title>{`Day ${p.label}: ${p.billable.toFixed(1)}h worked (Target: ${p.expected}h)\nBalance: ${p.val >= 0 ? '+' : ''}${p.val.toFixed(1)}h`}</title>
            </circle>
            {(i % 5 === 0 || i === points.length - 1) && (
              <text x={p.x} y={height + 15} fill="#666" fontSize="10" textAnchor="middle">{p.label}</text>
            )}
          </g>
        ))}

        {points.length > 0 && (
          <g>
            <rect 
              x={points[points.length-1].x - 25} 
              y={points[points.length-1].y - 25} 
              width="50" height="20" rx="4" 
              fill="#333" stroke="#555"
            />
            <text x={points[points.length-1].x} y={points[points.length-1].y - 11} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">
              {points[points.length-1].val >= 0 ? '+' : ''}{points[points.length-1].val.toFixed(1)}h
            </text>
          </g>
        )}
      </svg>
      <div style={{ marginTop: '20px', fontSize: '0.75rem', color: '#888', textAlign: 'center' }}>
        Shows cumulative deviation from 8h/weekday target. Returns to 0 when exactly on schedule.
      </div>
    </div>
  );
  }

  function MixtureChart({ entries, label }: { entries: any[], label: string }) {
  // Group by date
  const daily: any = {};
  entries.forEach(e => {
    if (!e.date) return;
    if (!daily[e.date]) daily[e.date] = { billable: 0, nonbillable: 0 };
    if (e.nonbillable) daily[e.date].nonbillable += e.duration_hours;
    else daily[e.date].billable += e.duration_hours;
  });

  const sortedDates = Object.keys(daily).sort();
  const maxHours = Math.max(...Object.values(daily).map((d: any) => d.billable + d.nonbillable), 8);
  
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1rem' }}>{label}</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '100px', padding: '0 10px', gap: '8px' }}>
        {sortedDates.map(date => {
          const d = daily[date];
          const total = d.billable + d.nonbillable;
          return (
            <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{ 
                width: '100%', 
                height: '80px', 
                background: '#333', 
                borderRadius: '3px', 
                display: 'flex', 
                flexDirection: 'column-reverse',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{ height: `${(d.billable / maxHours) * 100}%`, background: '#ff9800', transition: 'height 0.5s' }} title={`Billable: ${d.billable.toFixed(1)}h`}></div>
                <div style={{ height: `${(d.nonbillable / maxHours) * 100}%`, background: '#00bcd4', transition: 'height 0.5s' }} title={`Non-billable: ${d.nonbillable.toFixed(1)}h`}></div>
                {total > 8 && <div style={{ position: 'absolute', bottom: `${(8/maxHours)*100}%`, width: '100%', height: '1px', background: 'rgba(255,255,255,0.3)', borderTop: '1px dashed #fff' }}></div>}
              </div>
              <span style={{ fontSize: '8px', color: '#666' }}>{date.split('-')[2]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '15px', fontSize: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', background: '#ff9800', borderRadius: '2px' }}></div>
          <span style={{ color: '#ff9800' }}>FUEL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', background: '#00bcd4', borderRadius: '2px' }}></div>
          <span style={{ color: '#00bcd4' }}>AIR</span>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ months, onPointClick }: { months: HistoricalMonth[], onPointClick: (m: HistoricalMonth) => void }) {
  const maxDiff = Math.max(...months.map(m => Math.abs(m.hours_diff)), 20);
  const height = 150;
  const width = 600;
  const padding = 30;
  
  const points = months.map((m, i) => {
    const x = padding + (i * (width - 2 * padding) / (months.length - 1 || 1));
    const y = height / 2 - (m.hours_diff / maxDiff) * (height / 2 - padding);
    return { x, y, val: m.hours_diff, monthData: m };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  const nbStartPoint = points.find(p => p.monthData.year === 2025 && p.monthData.month === 8);
  const mathFixPoint = points.find(p => p.monthData.year === 2026 && p.monthData.month === 4);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#444" strokeDasharray="4 2" />
      <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#222" />
      <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#222" />
      
      {nbStartPoint && (
        <>
          <line x1={nbStartPoint.x} y1={padding} x2={nbStartPoint.x} y2={height-padding} stroke="#666" strokeDasharray="2 2" />
          <text x={nbStartPoint.x - 5} y={padding - 5} fill="#666" fontSize="9" fontWeight="bold" textAnchor="end">NB TRACKING</text>
        </>
      )}

      {mathFixPoint && (
        <>
          <line x1={mathFixPoint.x} y1={padding} x2={mathFixPoint.x} y2={height-padding} stroke="#f39c12" strokeDasharray="2 2" />
          <text 
            x={mathFixPoint.x > width - 100 ? mathFixPoint.x - 5 : mathFixPoint.x + 5} 
            y={padding - 5} 
            fill="#f39c12" 
            fontSize="9" 
            fontWeight="bold"
            textAnchor={mathFixPoint.x > width - 100 ? "end" : "start"}
          >
            STRICT MATH
          </text>
        </>
      )}

      <path d={pathD} fill="none" stroke="#4caf50" strokeWidth="2" />
      {points.map((p, i) => (
        <circle 
          key={i} 
          cx={p.x} 
          cy={p.y} 
          r="6" 
          fill={p.val >= 0 ? '#4caf50' : '#f44336'} 
          onClick={() => onPointClick(p.monthData)}
          style={{cursor: 'pointer', transition: 'r 0.2s'}}
          onMouseOver={(e) => (e.target as any).setAttribute('r', '10')}
          onMouseOut={(e) => (e.target as any).setAttribute('r', '6')}
        />
      ))}
      {points.length > 0 && (
        <text x={points[points.length-1].x} y={points[points.length-1].y - 15} fill="#fff" fontSize="12" textAnchor="middle">
          {points[points.length-1].val.toFixed(1)}
        </text>
      )}
    </svg>
  );
}

export default App
