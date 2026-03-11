import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';
import { Dashboard } from './pages/Dashboard';
import { RunDetail } from './pages/RunDetail';
import { Constraints } from './pages/Constraints';
import { Products } from './pages/Products';
import { HitlConfig } from './pages/HitlConfig';
import { Team } from './pages/Team';
import Backlog from './pages/Backlog';
import Workflow from './pages/Workflow';

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/runs/:id" element={<ErrorBoundary><RunDetail /></ErrorBoundary>} />
          <Route path="/constraints" element={<ErrorBoundary><Constraints /></ErrorBoundary>} />
          <Route path="/hitl" element={<ErrorBoundary><HitlConfig /></ErrorBoundary>} />
          <Route path="/products" element={<ErrorBoundary><Products /></ErrorBoundary>} />
          <Route path="/team" element={<ErrorBoundary><Team /></ErrorBoundary>} />
          <Route path="/backlog" element={<ErrorBoundary><Backlog /></ErrorBoundary>} />
          <Route path="/workflow" element={<ErrorBoundary><Workflow /></ErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}
