import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ import useNavigate
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

const API_URL = 'https://api.hifitechsolns.com/api/donations/admin_dashboard/';
const TOKEN = '6ce29476cf123ac05e3236953148058c7c945f80';
const TOKEN = localStorage.getItem('adminToken');
const CHART_COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444'];

const AdminDashboard = () => {
  const navigate = useNavigate(); // ✅ initialize navigate
  const [donations, setDonations] = useState([]);
  const [filteredDonations, setFilteredDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);



  

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return navigate('/admin-login'); // ✅ navigate works now
    fetchDonations(token);

    const mql = window.matchMedia('(max-width: 900px)');
    setSidebarOpen(!mql.matches);
    const handler = (e) => setSidebarOpen(!e.matches);
    mql.addEventListener ? mql.addEventListener('change', handler) : mql.addListener(handler);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', handler) : mql.removeListener(handler);
    };
  }, [navigate]);

  useEffect(() => {
    applyFilters();
  }, [donations, searchTerm, statusFilter]);


    const fetchDonations = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_URL, {
          headers: {
            Authorization: `Token ${TOKEN}`, // always use the constant
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) throw new Error('Failed to fetch donations');
        const data = await res.json();
        setDonations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch donations');
      } finally {
        setLoading(false);
      }
    };







  const applyFilters = () => {
    let filtered = [...donations];
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((d) => (d.status || '').toUpperCase() === statusFilter);
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
  };

  const calculateStats = () => {
    const total = donations.length;
    const completed = donations.filter((d) => (d.status || '').toUpperCase() === 'COMPLETED').length;
    const pending = donations.filter((d) => (d.status || '').toUpperCase() === 'PENDING').length;
    const failed = donations.filter((d) => (d.status || '').toUpperCase() === 'FAILED').length;
    const totalAmount = donations
      .filter((d) => (d.status || '').toUpperCase() === 'COMPLETED')
      .reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    return { total, completed, pending, failed, totalAmount };
  };

  const stats = calculateStats();

  const topDonorsData = () => {
    const map = {};
    donations.forEach((d) => {
      const key = d.name || d.email || d.order_id || 'Anonymous';
      const amt = parseFloat(d.amount || 0);
      map[key] = (map[key] || 0) + (isFinite(amt) ? amt : 0);
    });
    const arr = Object.entries(map).map(([name, amount]) => ({ name, amount }));
    return arr.sort((a, b) => b.amount - a.amount).slice(0, 7);
  };

  const statusPieData = () => {
    const counts = {};
    donations.forEach((d) => {
      const s = (d.status || 'UNKNOWN').toUpperCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  const styles = {
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

  const topDonors = topDonorsData();
  const pieData = statusPieData();

  if (loading) {
    return (
      <div style={{ ...styles.root, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Loading dashboard…</div>
          <div style={{ color: '#64748b' }}>Fetching donations from the server</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* small-screen toggle */}
      <style>
        {`
          @media (max-width: 900px) { .mobileToggle { display: inline-flex !important; } .sidebarHidden { transform: translateX(0) !important; } }
          @media (max-width: 760px) { .statsGrid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .chartsGrid { grid-template-columns: 1fr !important; } .chartsRow { grid-template-columns: 1fr !important; } .sidebar { position: fixed; z-index: 60; top: 0; left: 0; height: 100vh; } }
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
          <div style={{ fontWeight: 800 }}>admin@lacharityorganisation.com</div>
        </div>
      </aside>

      <main style={styles.main}>
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
            <button onClick={() => fetchDonations(localStorage.getItem('adminToken'))} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(16,24,40,0.06)', background: 'white', cursor: 'pointer', fontWeight: 700 }}>🔄 Refresh</button>
           <div
  style={{
    position: 'fixed',    // stay fixed on screen
    top: 10,              // distance from top
    right: 10,            // distance from right
    zIndex: 500,          // above other elements
  }}
>
  <button
    onClick={() => {
      localStorage.removeItem('adminToken');
      navigate('/admin-login');
    }}
    style={{
      padding: '4px 7px',
      borderRadius: 10,
      border: '1px solid #e65c5c',
      background: '#e65c5c',
      color: 'white',
      cursor: 'pointer',
      fontWeight: 500,
    }}
  >
    Logout
  </button>
</div>

          </div>
        </div>

        {/* statistics */}
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

        {/* charts */}
        <div className="chartsGrid" style={styles.chartsRow}>
          <div style={{ ...styles.statCard, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Top donors (by amount)</div>
            {topDonors.length === 0 ? <div style={styles.noData}>No donation data for chart</div> : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDonors}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" fill={CHART_COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div style={{ ...styles.statCard, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Status breakdown</div>
            {pieData.length === 0 ? <div style={styles.noData}>No donations</div> : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={34} label>
                      {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* table */}
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
              {filteredDonations.length === 0 ? (
                <tr><td colSpan="6" style={styles.td}><div style={styles.noData}>No donations match your filters</div></td></tr>
              ) : (
                filteredDonations.slice(0, showAll ? filteredDonations.length : 5).map((d) => {
                  const status = (d.status || 'UNKNOWN').toUpperCase();
                  return (
                    <tr key={d.id || d.order_id || Math.random()}>
                      <td style={styles.td}>{d.order_id || 'N/A'}</td>
                      <td style={styles.td}>{d.name || `${d.first_name || ''} ${d.last_name || ''}`}</td>
                      <td style={styles.td}>{d.email || 'N/A'}</td>
                      <td style={styles.td}>{d.amount}</td>
                      <td style={styles.td}><span style={styles.statusBadge(status)}>{status}</span></td>
                      <td style={styles.td}>{formatDate(d.created_at || d.date_booked)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {filteredDonations.length > 5 && (
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
