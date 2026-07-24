import { useState, useEffect } from 'react'
import './App.css'
import Gauge from './components/Gauge'
import FuelGauge from './components/FuelGauge'
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

  // Month Paging State
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const isCurrentMonth = viewDate.getMonth() === now.getMonth() && viewDate.getFullYear() === now.getFullYear();

  useEffect(() => {
    const fetchData = async (url: string, fallback?: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (fallback) {
            console.warn(`Fetch to ${url} failed with status ${response.status}, falling back to ${fallback}`);
            const fallbackRes = await fetch(fallback);
            return await fallbackRes.json();
          }
          throw new Error(`Fetch failed: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          if (fallback) {
            console.warn(`Fetch to ${url} returned HTML instead of JSON, falling back to ${fallback}`);
            const fallbackRes = await fetch(fallback);
            return await fallbackRes.json();
          }
          throw new Error("Returned HTML instead of JSON");
        }
        
        return await response.json();
      } catch (e) {
        if (fallback) {
          console.error(`Error fetching ${url}, falling back to ${fallback}:`, e);
          const fallbackRes = await fetch(fallback);
          return await fallbackRes.json();
        }
        throw e;
      }
    };

    setLoading(true);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth() + 1;

    const mainDataUrl = isCurrentMonth ? '/api/data' : `/api/month?year=${year}&month=${month}`;
    const mainFallback = isCurrentMonth ? '/data.json' : undefined;

    Promise.all([
      fetchData(mainDataUrl, mainFallback),
      fetchData('/api/six', '/six.json'),
      fetchData('/api/history', '/history_summary.json'),
      fetchData('/api/groq', '/groq_summary.json')
    ])
    .then(([current, six, history, groq]) => {
      // Normalize historical month data to match TrackerData structure if needed
      if (!isCurrentMonth) {
        // Mock progress for historical month
        const histMonth = history.months.find((m: any) => m.year === year && m.month === month);
        const lastDay = new Date(year, month, 0).getDate();
        const start_date = `${year}-${String(month).padStart(2, '0')}-01`;
        const end_date = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        
        let total_hours = 0;
        let expected_hours = 0;
        let weekdays = 0;
        let hours_diff = 0;
        let percentage = 0;

        if (histMonth) {
          total_hours = histMonth.total_hours;
          expected_hours = histMonth.expected_hours;
          percentage = histMonth.percentage;
          hours_diff = histMonth.hours_diff;
          weekdays = histMonth.weekdays;
        } else {
          // Calculate dynamically from the historical month entries
          total_hours = (current.entries || [])
            .filter((e: any) => !e.nonbillable)
            .reduce((sum: number, e: any) => sum + e.duration_hours, 0);
          
          // Calculate weekdays
          const [sY, sM, sD] = start_date.split('-').map(Number);
          const [eY, eM, eD] = end_date.split('-').map(Number);
          const cur = new Date(sY, sM - 1, sD);
          const end = new Date(eY, eM - 1, eD);
          while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) weekdays++;
            cur.setDate(cur.getDate() + 1);
          }
          
          expected_hours = weekdays * 8.0;
          hours_diff = total_hours - expected_hours;
          percentage = expected_hours > 0 ? (total_hours / expected_hours) * 100 : 0;
        }

        setCurrentData({
          progress: {
            total_hours,
            expected_hours,
            percentage,
            hours_diff,
            status: hours_diff >= 0 ? 'over' : 'under',
            weekdays,
            start_date,
            end_date
          },
          entries: current.entries,
          generated_at: new Date().toISOString()
        });
      } else {
        setCurrentData(current);
      }
      setSixData(six);
      setHistoryData(history);
      setGroqData(groq);
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  }, [viewDate]);

  const changeMonth = (offset: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  if (loading) return <div className="loading">Loading Carburetor...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!currentData || !historyData || !sixData) return <div className="error">No data available</div>;

  const { progress, entries } = currentData;
  
  // Calculate BILLABLE only for current view
  const currentBillableHours = entries
    .filter(e => !e.nonbillable)
    .reduce((sum, e) => sum + e.duration_hours, 0);
  
  const currentBillableDiff = currentBillableHours - progress.expected_hours;

  // Historical context (for the bank/rolling balance)
  const historyMonths = historyData?.months || [];
  
  const relevantHistoricalMonths = historyMonths
    .filter(m => {
      const mDate = new Date(m.year, m.month - 1, 1);
      return mDate < viewDate;
    })
    .slice(-5);
    
  const historicalDiff = relevantHistoricalMonths.reduce((sum, m) => sum + m.hours_diff, 0);
  const compTimeBalance = historicalDiff + currentBillableDiff;
  const lookbackCount = relevantHistoricalMonths.length + 1;

  // Calculate billable vs nonbillable for this month
  const monthNonBillable = entries.filter((e: any) => e.nonbillable).reduce((sum: number, e: any) => sum + e.duration_hours, 0);

  // Calculate billable/nonbillable for Make Six (past 6 days)
  const sixBillable = sixData.entries
    .filter((e: any) => !e.nonbillable)
    .reduce((sum: number, e: any) => sum + e.duration_hours, 0);
  const sixNonBillable = sixData.entries
    .filter((e: any) => e.nonbillable)
    .reduce((sum: number, e: any) => sum + e.duration_hours, 0);

  // Daily processing for current month
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

  const allEntries = [...entries];
  if (isCurrentMonth && sixData?.entries) {
    const startStr = `${sY}-${String(sM).padStart(2, '0')}-01`;
    sixData.entries.forEach((e: any) => {
      if (e.date && e.date < startStr) {
        allEntries.push({
          activity: e.activity || '',
          duration: e.duration || '',
          duration_hours: e.duration_hours,
          nonbillable: e.nonbillable,
          date: e.date,
          note: e.note || ''
        });
      }
    });
  }

  const dailyEntries = allEntries.reduce((acc: any, e) => {
    if (!e.date) return acc;
    if (!acc[e.date]) acc[e.date] = { billable: 0, nonbillable: 0 };
    if (e.nonbillable) acc[e.date].nonbillable += e.duration_hours;
    else acc[e.date].billable += e.duration_hours;
    return acc;
  }, {});
  
  const dailyHistory: any[] = [];
  let runningBalance = 0;
  
  // Calculate start of context (3 days before start of current view)
  const contextStart = new Date(startDate);
  contextStart.setDate(contextStart.getDate() - 3);
  
  let currDateObj = new Date(contextStart);
  
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const endOfViewStr = isCurrentMonth ? todayStr : `${eY}-${String(eM).padStart(2, '0')}-${String(eD).padStart(2, '0')}`;
  const monthStartStr = `${sY}-${String(sM).padStart(2, '0')}-${String(sD).padStart(2, '0')}`;

  while (currDateObj <= endDate) {
    const dStr = `${currDateObj.getFullYear()}-${String(currDateObj.getMonth() + 1).padStart(2, '0')}-${String(currDateObj.getDate()).padStart(2, '0')}`;
    const isNewMonth = dStr === monthStartStr;
    const isContext = dStr < monthStartStr;
    
    // Reset balance at the official start of the month
    if (isNewMonth) runningBalance = 0;

    const dayData = dailyEntries[dStr] || { billable: 0, nonbillable: 0 };
    const expected = isWorkday(dStr) ? 8 : 0;
    
    runningBalance += dayData.billable - expected;
    
    // Only show context days if you actually worked (removes the "red deficit" lead-in)
    if (!isContext || dayData.billable > 0) {
      // Color logic: 
      // Workdays (M-F): Green if you hit the 8h target, otherwise red.
      // Weekends (S-S): Green if you did any work (>0h), otherwise neutral/red.
      const isWeekend = !isWorkday(dStr);
      let statusColor = '#f44336'; // Default red
      if (isWeekend) {
        statusColor = dayData.billable > 0 ? '#4caf50' : '#444'; // Green for effort, otherwise neutral
      } else {
        statusColor = dayData.billable >= 8 ? '#4caf50' : '#f44336'; // Green only if target hit
      }

      dailyHistory.push({
        date: dStr,
        billable: dayData.billable,
        expected: expected,
        hours_diff: runningBalance,
        label: dStr.split('-')[2],
        isContext: isContext,
        statusColor: statusColor
      });
    }
    
    if (dStr === endOfViewStr) break;
    currDateObj.setDate(currDateObj.getDate() + 1);
  }

  return (
    <div className="container">
      <header>
        <div className="header-main">
          <div className="title-group">
            <h1>Time Carburetor</h1>
            <div className="month-pager">
              <button onClick={() => changeMonth(-1)} className="pager-btn">&lt;</button>
              <span className="current-month-label">
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button 
                onClick={() => changeMonth(1)} 
                className="pager-btn" 
                disabled={isCurrentMonth}
              >&gt;</button>
              {!isCurrentMonth && (
                <button onClick={() => setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))} className="today-btn">Current</button>
              )}
            </div>
          </div>
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
              {isCurrentMonth ? 'Monthly' : 'Period'}: <strong>{currentBillableDiff >= 0 ? '+' : ''}{currentBillableDiff.toFixed(1)}h</strong>
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
            <FuelGauge 
              billable={sixBillable} 
              nonbillable={sixNonBillable} 
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
                    ...historyData.months.filter(m => {
                      const mDate = new Date(m.year, m.month - 1, 1);
                      return mDate < viewDate;
                    }),
                    {
                      year: viewDate.getFullYear(),
                      month: viewDate.getMonth() + 1,
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
          <p>Expectation based on 8h/weekday up to current date. (Build: 2026-05-19.2315)</p>
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
    if (data.length === 0) return null;

    const maxDiff = Math.max(...data.map(d => Math.abs(d.hours_diff)), 8);
    const height = 150;
    const width = 600;
    const padding = 30;

    // Get the year and month from the first main point
    const firstMainPoint = data.find(d => !d.isContext);
    const refDateStr = firstMainPoint ? firstMainPoint.date : data[0].date;
    const [refY, refM] = refDateStr.split('-').map(Number);
    
    const startDate = new Date(refY, refM - 1, 1);
    const lastDay = new Date(refY, refM, 0).getDate();

    const minDiffDays = -3;
    const maxDiffDays = lastDay - 1;

    const getX = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      
      const diffTime = dateObj.getTime() - startDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      const fraction = (diffDays - minDiffDays) / (maxDiffDays - minDiffDays);
      return padding + fraction * (width - 2 * padding);
    };

    const points = data.map((d) => {
      const x = getX(d.date);
      const y = height / 2 - (d.hours_diff / maxDiff) * (height / 2 - padding);
      return { ...d, x, y };
    });

    // Separate context and main month points for independent paths (allows discontinuity)
    const contextPoints = points.filter(p => p.isContext);
    const mainPoints = points.filter(p => !p.isContext);

    const getPath = (pts: any[]) => pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const contextPath = getPath(contextPoints);
    const mainPath = getPath(mainPoints);

    // Position of divider line is -0.5 days (halfway between last day of last month and first day of this month)
    const dividerX = padding + (-0.5 - minDiffDays) / (maxDiffDays - minDiffDays) * (width - 2 * padding);

    const formatDateTooltip = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
      <div className="daily-chart-wrapper">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#444" strokeDasharray="4 2" />
          
          {dividerX && (
            <g>
              <line x1={dividerX} y1={padding} x2={dividerX} y2={height-padding} stroke="#666" strokeDasharray="2 2" />
              <text x={dividerX + 5} y={padding} fill="#666" fontSize="8" fontWeight="bold">PERIOD START (0.0h)</text>
            </g>
          )}

          <defs>
            <linearGradient id="gradient-daily" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4caf50" />
              <stop offset="50%" stopColor="transparent" />
              <stop offset="100%" stopColor="#f44336" />
            </linearGradient>
          </defs>

          {/* Fill and Path for Context */}
          {contextPath && (
            <g opacity="0.4">
              <path d={contextPath} fill="none" stroke="#3498db" strokeWidth="2" strokeDasharray="4 2" />
            </g>
          )}

          {/* Fill and Path for Main Month */}
          {mainPath && (
            <>
              <path 
                d={`${mainPath} L ${mainPoints[mainPoints.length-1].x} ${height/2} L ${mainPoints[0].x} ${height/2} Z`} 
                fill="url(#gradient-daily)" 
                opacity="0.2" 
              />
              <path d={mainPath} fill="none" stroke="#3498db" strokeWidth="2" />
            </>
          )}
          
          {points.map((p, i) => (
            <g key={i} style={{ opacity: p.isContext ? 0.4 : 1 }}>
              <circle 
                cx={p.x} 
                cy={p.y} 
                r={i === points.length - 1 ? "5" : "3"} 
                fill={p.statusColor} 
                style={{ transition: 'all 0.3s' }}
              >
                <title>{`${formatDateTooltip(p.date)}${p.isContext ? ' (Previous Month lookback)' : ''}\nBillable worked: ${p.billable.toFixed(1)}h (Target: ${p.expected}h)\nDaily balance: ${p.billable - p.expected >= 0 ? '+' : ''}${(p.billable - p.expected).toFixed(1)}h\nRunning period balance: ${p.hours_diff >= 0 ? '+' : ''}${p.hours_diff.toFixed(1)}h`}</title>
              </circle>
            </g>
          ))}
          
          {/* Draw fixed X-axis labels for the month */}
          {Array.from({ length: Math.ceil(lastDay / 5) + 1 }, (_, index) => {
            const dayNum = index * 5 || 1; // 1, 5, 10, 15, ...
            if (dayNum > lastDay) return null;
            
            const diffDays = dayNum - 1;
            const fraction = (diffDays - minDiffDays) / (maxDiffDays - minDiffDays);
            const x = padding + fraction * (width - 2 * padding);
            
            return (
              <text key={dayNum} x={x} y={height + 15} fill="#666" fontSize="10" textAnchor="middle">
                {dayNum}
              </text>
            );
          })}

          {/* Draw a label for the previous month lookback area */}
          <text 
            x={padding + (-1.5 - minDiffDays) / (maxDiffDays - minDiffDays) * (width - 2 * padding)} 
            y={height + 15} 
            fill="#666" 
            fontSize="9" 
            fontWeight="bold" 
            textAnchor="middle" 
            opacity="0.6"
          >
            LOOKBACK
          </text>

          {mainPoints.length > 0 && (
            <g>
              <rect 
                x={mainPoints[mainPoints.length-1].x - 25} 
                y={mainPoints[mainPoints.length-1].y - 25} 
                width="50" height="20" rx="4" 
                fill="#333" stroke="#555"
              />
              <text x={mainPoints[mainPoints.length-1].x} y={mainPoints[mainPoints.length-1].y - 11} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">
                {mainPoints[mainPoints.length-1].hours_diff >= 0 ? '+' : ''}{mainPoints[mainPoints.length-1].hours_diff.toFixed(1)}h
              </text>
            </g>
          )}
        </svg>
        <div style={{ marginTop: '20px', fontSize: '0.75rem', color: '#888', textAlign: 'center' }}>
          Current period cumulative: {mainPoints[mainPoints.length-1]?.hours_diff.toFixed(1)}h
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
