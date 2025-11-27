import React, { useState } from "react";
import axios, { AxiosError } from "axios"; // Import AxiosError for type safety
import { useNavigate } from "react-router-dom";

// Note: Ensure this URL matches your Django endpoint
const API_LOGIN_URL = "https://api.hifitechsolns.com/api/donations/admin_login/"; 

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // Added loading state
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents default page reload on form submission
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(API_LOGIN_URL, {
        username,
        password,
      });

      // Assuming Django DRF Simple JWT returns 'access' and 'refresh'
      const accessToken = res.data.access || res.data.token; 
      const adminUsername = res.data.username || username;

      if (accessToken) {
        // Store access token and username
        localStorage.setItem("adminToken", accessToken);
        localStorage.setItem("adminUsername", adminUsername); 
        navigate("/admin-dashboard");
      } else {
        setError("Login successful, but no token was provided by the server.");
      }

    } catch (err) {
      // Use AxiosError for safer type checking
      const axiosError = err as AxiosError<{ detail?: string }>;

      // Extract error message from Django's typical structure
      const errorMessage = axiosError.response?.data?.detail 
        ? axiosError.response.data.detail 
        : "Login failed. Check your credentials.";
        
      setError(errorMessage);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleLogin}>
        <h2 style={styles.title}>Admin Login</h2>

        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
        />

        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />

        <button 
          style={styles.button} 
          type="submit" 
          disabled={loading}
        >
          {loading ? "Logging In..." : "Login"}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
};

// --- Styles object (Unchanged but included for completeness) ---

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
