// App.tsx or your router file
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DonationForm from "./components/DonationForm";
import PaymentSuccess from "./components/PaymentSuccess";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DonationForm />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/donate" element={<DonationForm />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;