import React, { useEffect, useState } from 'react';
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

const API_URL = 'https://api.hifitechsolns.com/api/donations/admin_dashboard/';
const CHART_COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444'];

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

  // Redirect to login if no token
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return navigate('/admin-login'); // Redirect if not logged in
    fetchDonations(token);

    // Responsive sidebar
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

  const fetchDonations = async (token) => {
    try {
      setLoading(true);
      const res = await fetch(API_URL, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          // Unauthorized, remove token and redirect
          localStorage.removeItem('adminToken');
          return navigate('/admin-login');
        }
        throw new Error('Failed to fetch donations');
      }
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
        const name = (d.name || `${d.first_name || ''} ${d.last_name || ''}`).toLowerCase();
        const email = (d.email || '').toLowerCase();
        const orderId = (d.order_id || '').toLowerCase();
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
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7);
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

  const topDonors = topDonorsData();
  const pieData = statusPieData();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <div>
          <h2>Loading dashboard…</h2>
          <p>Fetching donations from the server</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 280 : 0, transition: 'width 0.3s', background: '#111827', color: 'white', padding: 20 }}>
        <h2>Admin Dashboard</h2>
        <nav>
          {['Dashboard', 'Donations', 'Donors', 'Reports', 'Settings'].map((item) => (
            <div key={item} style={{ padding: 10, cursor: 'pointer' }}>{item}</div>
          ))}
        </nav>
        <button
          style={{ marginTop: 20, background: '#e65c5c', color: 'white', padding: 8, borderRadius: 5 }}
          onClick={() => {
            localStorage.removeItem('adminToken');
            navigate('/admin-login');
          }}
        >
          Logout
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <input
            placeholder="Search by name, email or order ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: 8, width: 300 }}
          />
          {['ALL', 'COMPLETED', 'PENDING', 'FAILED'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ margin: 5 }}>
              {s}
            </button>
          ))}
        </div>

        <h3>Top Donors</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={topDonors}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill={CHART_COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <h3>Status Breakdown</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={30} label>
                {pieData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <h3>Donations</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredDonations.length === 0 ? (
              <tr>
                <td colSpan={6}>No donations found</td>
              </tr>
            ) : (
              filteredDonations.slice(0, showAll ? filteredDonations.length : 5).map((d) => (
                <tr key={d.id || d.order_id}>
                  <td>{d.order_id}</td>
                  <td>{d.name}</td>
                  <td>{d.email}</td>
                  <td>{d.amount}</td>
                  <td>{d.status}</td>
                  <td>{formatDate(d.created_at || d.date_booked)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredDonations.length > 5 && (
          <button onClick={() => setShowAll((s) => !s)} style={{ marginTop: 10 }}>
            {showAll ? 'Show Less' : 'Show All'}
          </button>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
