import { LogFilterBar } from './LogFilterBar';
import { LogViewer } from './LogViewer';

export function Debug() {
  return (
    <div className="h-full flex flex-col gap-4 animate-fade-up" style={{ minHeight: 0 }}>
      <LogFilterBar />
      <LogViewer />
    </div>
  );
}
