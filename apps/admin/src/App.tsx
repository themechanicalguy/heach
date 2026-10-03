import { AdminLayout } from './layout/AdminLayout';
import { Dashboard } from './pages/Dashboard';

export function App() {
  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
