import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useStore } from './store';
import { ExportView } from './views/Export';
import { LeadDetailView } from './views/LeadDetail';
import { LeadsView } from './views/Leads';
import { SearchView } from './views/Search';

export default function App() {
  const activeView = useStore((state) => state.activeView);
  const loadLeads = useStore((state) => state.loadLeads);
  const runDiscovery = useStore((state) => state.runDiscovery);

  useEffect(() => {
    void Promise.all([loadLeads(), runDiscovery()]);
  }, [loadLeads, runDiscovery]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#07111c_0%,#0b1320_38%,#111827_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-6 py-6 lg:px-8">
            {activeView === 'search' && <SearchView />}
            {activeView === 'leads' && <LeadsView />}
            {activeView === 'detail' && <LeadDetailView />}
            {activeView === 'export' && <ExportView />}
          </main>
        </div>
      </div>
    </div>
  );
}
