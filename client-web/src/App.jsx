import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ClientLayout from "./layout/ClientLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PetsPage from "./pages/PetsPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import AppointmentsPage from "./pages/AppointmentsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

export default function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/cadastro" element={<RegisterPage/>}/><Route element={<ProtectedRoute/>}><Route element={<ClientLayout/>}><Route index element={<HomePage/>}/><Route path="/pets" element={<PetsPage/>}/><Route path="/agendar" element={<BookingPage/>}/><Route path="/agendamentos" element={<AppointmentsPage/>}/><Route path="/perfil" element={<ProfilePage/>}/></Route></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
