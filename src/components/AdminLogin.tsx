import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(""); // clear error
    try {
      const res = await axios.post("https://api.hifitechsolns.com/api/donations/admin_login/", {
        username,
        password,
      });

      // Django returns { token: "abc123..." }
      localStorage.setItem("adminToken", res.data.token);

      navigate("/admin-dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid username or password");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Admin Login</h2>

        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button style={styles.button} onClick={handleLogin}>
          Login
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1e293b, #0f172a)",
  },
  card: {
    width: 350,
    padding: 30,
    borderRadius: 12,
    background: "#ffffff",
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.2)",
    textAlign: "center" as const,
  },
  title: {
    marginBottom: 20,
    color: "#0f172a",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 16,
  },
  button: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#2563eb",
    color: "white",
    fontWeight: 700,
    fontSize: 16,
  },
  error: {
    color: "red",
    marginTop: 10,
    fontWeight: 600,
  },
};

export default AdminLogin;
