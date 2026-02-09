import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { RunDetail } from './pages/RunDetail';
import { Constraints } from './pages/Constraints';
import { Products } from './pages/Products';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/runs/:id" element={<ErrorBoundary><RunDetail /></ErrorBoundary>} />
          <Route path="/constraints" element={<ErrorBoundary><Constraints /></ErrorBoundary>} />
          <Route path="/products" element={<ErrorBoundary><Products /></ErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
