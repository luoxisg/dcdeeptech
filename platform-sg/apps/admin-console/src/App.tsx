import { useStore } from './store';
import { useMetricsSimulator } from './hooks/useMetricsSimulator';
import { useLogStream } from './hooks/useLogStream';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './views/Dashboard';
import { Playground } from './views/Playground';
import { Routing } from './views/Routing';
import { Nodes } from './views/Nodes';
import { Debug } from './views/Debug';
import { Keys } from './views/Keys';
import { Compliance } from './views/Compliance';

export default function App() {
  // Mount background simulators once at root
  useMetricsSimulator();
  useLogStream();

  const activeView = useStore((s) => s.activeView);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-auto p-6" style={{ minHeight: 0 }}>
          {activeView === 'dashboard'  && <Dashboard />}
          {activeView === 'playground' && <Playground />}
          {activeView === 'routing'    && <Routing />}
          {activeView === 'nodes'      && <Nodes />}
          {activeView === 'debug'      && <Debug />}
          {activeView === 'keys'       && <Keys />}
          {activeView === 'compliance' && <Compliance />}
        </main>
      </div>
    </div>
  );
}
