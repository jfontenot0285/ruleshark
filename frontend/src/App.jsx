import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/try" element={<Navigate to="/#try" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
