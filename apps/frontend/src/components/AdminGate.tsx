import { useAuth } from '../hooks/useAuth';

interface AdminGateProps {
  children: React.ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  return <>{children}</>;
}
