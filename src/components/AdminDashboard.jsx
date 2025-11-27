import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// --- Configuration ---
// Note: Use environment variables (e.g., .env file) for real deployments
const API_BASE_URL = 'https://api.hifitechsolns.com/api/donations/';
const ADMIN_DASHBOARD_URL = `${API_BASE_URL}admin_dashboard/`;
const CHART_COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444'];
// ---------------------

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [donations, setDonations] = useState([]);
  const [filteredDonations, setFilteredDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // --- Utility Functions ---

  // Safely converts input to a number or returns 0
  const safeParseFloat = (value) => {
    const num = parseFloat(value);
    return isFinite(num) ? num : 0;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername'); // Clear username if stored
    navigate('/admin-login');
  }, [navigate]);

  // --- Data Fetching ---
  const fetchDonations = useCallback(async () => {
    setError(null);
    const token = localStorage.getItem('adminToken');
    
    if (!token) {
      console.warn('No adminToken found - redirecting to login');
      logout();
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(ADMIN_DASHBOARD_URL, {
        headers: {
          // FIX: Use Bearer token, which is common with Django REST Framework JWT
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401 || res.status === 403) {
        console.warn('Unauthorized / Forbidden from API, clearing token and redirecting.', res.status);
        logout();
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => 'No response body');
        throw new Error(`API error ${res.status} ${res.statusText}. Response: ${text.substring(0, 100)}`);
      }

      const data = await res.json();
      console.debug('Admin dashboard API returned:', data);

      // FIX: Standardize response handling. Assuming Django DRF returns an array or an object with 'results'
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.results)) {
        list = data.results; // DRF pagination default
      } else if (Array.isArray(data.data)) {
        list = data.data; // Custom wrapper
      } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Handle case where it might be a single object, but expecting array
        list = [data]; 
      }
      
      setDonations(list.filter(d => d.id)); // Filter out any items missing an ID
    } catch (err) {
      console.error('Failed to fetch donations:', err);
      setError(`Failed to fetch donations: ${err.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // --- Lifecycle and Media Query ---
  useEffect(() => {
    fetchDonations();

    // Media query handler for sidebar visibility
    const mql = window.matchMedia('(max-width: 900px)');
    setSidebarOpen(!mql.matches);
    const handler = (e) => setSidebarOpen(!e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [fetchDonations]);

  // --- Filtering Logic ---
  useEffect(() => {
    let filtered = [...donations];
    
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((d) => (String(d.status || '')).toUpperCase() === statusFilter);
    }
    
    if (searchTerm && searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((d) => {
        const name = (d.name || `${d.first_name || ''} ${d.last_name || ''}`).toString().toLowerCase();
        const email = (d.email || '').toString().toLowerCase();
        const orderId = (d.order_id || '').toString().toLowerCase();
        return name.includes(q) || email.includes(q) || orderId.includes(q);
      });
    }
    setFilteredDonations(filtered);
  }, [donations, searchTerm, statusFilter]);

  // --- Data Calculations ---
  const calculateStats = () => {
    const total = donations.length;
    const completed = donations.filter((d) => (String(d.status || '')).toUpperCase() === 'COMPLETED').length;
    const pending = donations.filter((d) => (String(d.status || '')).toUpperCase() === 'PENDING').length;
    const failed = donations.filter((d) => (String(d.status || '')).toUpperCase() === 'FAILED').length;
    
    // FIX: Use safeParseFloat
    const totalAmount = donations
      .filter((d) => (String(d.status || '')).toUpperCase() === 'COMPLETED')
      .reduce((s, d) => s + safeParseFloat(d.amount), 0);
      
    return { total, completed, pending, failed, totalAmount };
  };

  const stats = calculateStats();

  const topDonorsData = () => {
    const map = {};
    donations.forEach((d) => {
      const key = d.name || d.email || d.order_id || 'Anonymous';
      const amt = safeParseFloat(d.amount); // FIX: Use safeParseFloat
      map[key] = (map[key] || 0) + amt;
    });
    const arr = Object.entries(map).map(([name, amount]) => ({ name, amount }));
    return arr.sort((a, b) => b.amount - a.amount).slice(0, 7);
  };

  const pieData = () => {
    const counts = {};
    donations.forEach((d) => {
      const s = (d.status || 'UNKNOWN').toString().toUpperCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };
  
  const topDonors = topDonorsData();
  const statusPieData = pieData();

  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      // FIX: Use a more robust date parsing mechanism if necessary, but this should work for ISO strings
      return new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }); 
    } catch {
      return String(d);
    }
  };

  // --- Styles (Unchanged for Design Preservation) ---
  const styles = {
    // ... (Your original styles object goes here, unchanged) ...
    root: {
      display: 'flex',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      background: 'linear-gradient(135deg,#f3f4f6 0%, #eef2ff 100%)',
      color: '#0f172a',
    },
    sidebar: {
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      width: 280,
      background: 'linear-gradient(180deg,#0f172a 0%, #111827 100%)',
      color: 'white',
      padding: 20,
      boxShadow: '4px 0 30px rgba(2,6,23,0.2)',
      borderRight: '1px solid rgba(255,255,255,0.03)',
      transition: 'transform 220ms ease',
      zIndex: 50,
    },
    sidebarHidden: { transform: 'translateX(-110%)', position: 'fixed', zIndex: 50 },
    logo: { fontSize: 22, fontWeight: 800, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 },
    navItem: {
      padding: '12px 14px',
      borderRadius: 10,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 8,
      fontWeight: 600,
    },
    main: { flex: 1, padding: 28, marginLeft: 280, minWidth: 0 },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    pageTitle: { fontSize: 28, fontWeight: 800, color: '#111827' },
    controls: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
    input: { padding: '10px 14px', borderRadius: 10, border: '1px solid #e6e9ef', minWidth: 240, outline: 'none' },
    filterBtn: (active) => ({
      padding: '9px 14px',
      borderRadius: 10,
      border: '1px solid transparent',
      cursor: 'pointer',
      background: active ? '#667eea' : 'white',
      color: active ? 'white' : '#111827',
      fontWeight: 700,
    }),
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 20 },
    statCard: { background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 8px 24px rgba(16,24,40,0.06)' },
    chartsRow: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 },
    tableWrap: { background: 'white', borderRadius: 12, padding: 12, boxShadow: '0 12px 30px rgba(2,6,23,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '12px 10px', borderBottom: '1px solid #eef2f6', color: '#374151', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' },
    td: { padding: '12px 10px', borderBottom: '1px solid #f3f4f6', color: '#111827' },
    statusBadge: (status) => {
      const map = {
        COMPLETED: { background: '#d1fae5', color: '#065f46' },
        PENDING: { background: '#fff7ed', color: '#92400e' },
        FAILED: { background: '#fee2e2', color: '#991b1b' },
      };
      return { display: 'inline-block', padding: '6px 12px', borderRadius: 999, fontWeight: 800, fontSize: 12, ...(map[status] || { background: '#eef2ff', color: '#1e293b' }) };
    },
    mobileToggle: { display: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', border: '1px solid rgba(16,24,40,0.06)', background: 'white' },
    noData: { padding: 28, textAlign: 'center', color: '#64748b' },
  };
  // --- End Styles ---

  if (loading) {
    return (
      <div style={{ ...styles.root, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Loading dashboard…</div>
          <div style={{ color: '#64748b' }}>Fetching donations from the server</div>
          {error && <div style={{ color: '#ef4444', marginTop: 10, fontWeight: 600 }}>Error: {error}</div>}
        </div>
      </div>
    );
  }
  
  // Display error message if fetching failed after loading
  if (error && !donations.length) {
    return (
      <div style={{ ...styles.root, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#ef4444' }}>Data Loading Failed</div>
          <div style={{ color: '#64748b' }}>{error}</div>
          <button onClick={fetchDonations} style={{ marginTop: 15, padding: '8px 16px', borderRadius: 10, background: '#667eea', color: 'white', border: 'none', cursor: 'pointer' }}>Try Refreshing</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>
        {`
          /* Media queries for responsiveness */
          @media (max-width: 900px) { .mobileToggle { display: inline-flex !important; } .main { margin-left: 0 !important; } .sidebar { transition: transform 220ms ease; } .sidebarHidden { transform: translateX(-100%) !important; } }
          @media (max-width: 760px) { .statsGrid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .chartsGrid { grid-template-columns: 1fr !important; } .chartsRow { grid-template-columns: 1fr !important; } .topBar { flex-direction: column; align-items: flex-start; gap: 15px; } .controls { margin-top: 10px; } }
          @media (max-width: 500px) { .statsGrid { grid-template-columns: 1fr !important; } }
        `}
      </style>

      <aside style={{ ...styles.sidebar, display: 'flex', flexDirection: 'column', ...(sidebarOpen ? {} : styles.sidebarHidden) }} className="sidebar">
        <div style={styles.logo}>
          <img src="/charity.jpg" alt="LA Charity Logo" style={{ width: 60, height: 60, borderRadius: '50%' }} />
          <span>LA CHARITY Donations.</span>
        </div>
        <nav style={{ flex: 1 }}>
          {['Dashboard', 'Donations', 'Donors', 'Reports', 'Settings'].map((item) => (
            <div key={item} style={styles.navItem} title={item}>
              <span>{item === 'Dashboard' ? '📊' : item === 'Donations' ? '💳' : item === 'Donors' ? '👥' : item === 'Reports' ? '📈' : '⚙️'}</span>
              <span>{item}</span>
            </div>
          ))}
        </nav>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          <div style={{ marginBottom: 8 }}>Signed in as</div>
          <div style={{ fontWeight: 800 }}>{localStorage.getItem('adminUsername') || 'Admin User'}</div>
        </div>
      </aside>

      <main style={{...styles.main, marginLeft: sidebarOpen ? 280 : 0}} className="main">
        <div style={styles.topBar}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => setSidebarOpen((s) => !s)} className="mobileToggle" style={styles.mobileToggle}>☰</button>
            <div>
              <div style={styles.pageTitle}>Admin Dashboard</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>Overview of donations and donors</div>
            </div>
          </div>
          <div style={styles.controls}>
            <input placeholder="Search by name, email or order ID" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.input} />
            {['ALL', 'COMPLETED', 'PENDING', 'FAILED'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} style={styles.filterBtn(statusFilter === s)}>{s}</button>
            ))}
            <button onClick={fetchDonations} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(16,24,40,0.06)', background: 'white', cursor: 'pointer', fontWeight: 700 }}>🔄 Refresh</button>
            <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 500 }}>
              <button onClick={logout} style={{ padding: '4px 7px', borderRadius: 10, border: '1px solid #e65c5c', background: '#e65c5c', color: 'white', cursor: 'pointer', fontWeight: 500 }}>Logout</button>
            </div>
          </div>
        </div>

        <div className="statsGrid" style={styles.statsRow}>
          {['Total donations', 'Completed', 'Pending', 'Failed'].map((label, idx) => {
            const value = label === 'Total donations' ? stats.totalAmount.toFixed(2) : label === 'Completed' ? stats.completed : label === 'Pending' ? stats.pending : stats.failed;
            const subtitle = label === 'Total donations' ? `${stats.total} donations` : `${((value / (stats.total || 1)) * 100).toFixed(0)}% of total`;
            return (
              <div key={idx} style={styles.statCard}>
                <div style={{ color: '#64748b', fontWeight: 700, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{label === 'Total donations' ? `Shs.${value}` : value}</div>
                <div style={{ marginTop: 8, color: '#94a3b8' }}>{subtitle}</div>
              </div>
            );
          })}
        </div>
        
        {/* Error notification for charts and table if data is empty */}
        {donations.length === 0 && (
            <div style={{...styles.noData, background: 'white', borderRadius: 12, marginBottom: 20}}>
                No donation records found. Please ensure your API is returning data.
            </div>
        )}

        <div className="chartsGrid" style={styles.chartsRow}>
          <div style={{ ...styles.statCard, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Top donors (by amount)</div>
            {topDonors.length === 0 ? <div style={styles.noData}>No donation data for chart</div> : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDonors}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip formatter={(value) => [`Shs.${value.toFixed(2)}`, 'Amount']} />
                    <Legend />
                    <Bar dataKey="amount" fill={CHART_COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div style={{ ...styles.statCard, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Status breakdown</div>
            {statusPieData.length === 0 ? <div style={styles.noData}>No donations</div> : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={34} label>
                      {statusPieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Order ID</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredDonations.length === 0 && donations.length > 0 ? (
                 <tr><td colSpan="6" style={styles.td}><div style={styles.noData}>No donations match your current filters</div></td></tr>
              ) : filteredDonations.length === 0 && donations.length === 0 ? (
                 <tr><td colSpan="6" style={styles.td}><div style={styles.noData}>No donation records found in the database.</div></td></tr>
              ) : (
                filteredDonations.slice(0, showAll ? filteredDonations.length : 10).map((d) => { // Increased visible rows to 10
                  const status = (d.status || 'UNKNOWN').toString().toUpperCase();
                  return (
                    <tr key={d.id || d.order_id || Math.random()}>
                      <td style={styles.td}>{d.order_id || 'N/A'}</td>
                      <td style={styles.td}>{d.name || `${d.first_name || ''} ${d.last_name || ''}`}</td>
                      <td style={styles.td}>{d.email || 'N/A'}</td>
                      <td style={styles.td}>{safeParseFloat(d.amount).toFixed(2)} {d.currency || 'UGX'}</td>
                      <td style={styles.td}><span style={styles.statusBadge(status)}>{status}</span></td>
                      <td style={styles.td}>{formatDate(d.created_at || d.date_booked)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filteredDonations.length > 10 && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button onClick={() => setShowAll((s) => !s)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(16,24,40,0.06)', cursor: 'pointer' }}>{showAll ? 'Show Less' : 'Show All'}</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
