import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Cpu, Hash } from 'lucide-react';
import { api } from '../api/client';
import type { LogEntry } from '../api/client';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

function formatStage(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(ms: unknown): string {
  if (typeof ms === 'number') {
    if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms.toFixed(0)}ms`;
  }
  return '';
}

export default function Logs() {
  const query = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.getLogs(),
    refetchInterval: 10_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner label="Loading logs..." />
      </div>
    );
  }

  const logs = query.data?.logs || [];

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No logs yet"
        description="Run the pipeline or agent to see timing and token logs here."
      />
    );
  }

  // Group logs by run_id
  const grouped = logs.reduce<Record<string, LogEntry[]>>((acc, log) => {
    const rid = log.run_id || 'unknown';
    if (!acc[rid]) acc[rid] = [];
    acc[rid].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Logs</h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Timing and token usage from recent pipeline runs
        </p>
      </motion.div>

      <div className="space-y-4">
        {Object.entries(grouped).reverse().map(([runId, entries], groupIdx) => (
          <motion.div
            key={runId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIdx * 0.03 }}
            className="bg-bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-3 bg-bg-elevated border-b border-border-subtle">
              <Hash className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-mono text-text-secondary">{runId}</span>
              <span className="text-[10px] text-text-muted ml-auto">
                {entries.length} entries
              </span>
            </div>
            <div className="divide-y divide-border-subtle">
              {entries.map((entry, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-bg-hover transition-colors">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Cpu className="w-3.5 h-3.5 text-accent-light" />
                    <span className="text-xs font-medium text-text-primary">
                      {formatStage(entry.stage)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    {Object.entries(entry).map(([key, val]) => {
                      if (['run_id', 'stage'].includes(key)) return null;
                      if (typeof val === 'number' && key.endsWith('_ms')) {
                        return (
                          <span key={key} className="flex items-center gap-1 text-xs text-text-muted">
                            <Clock className="w-3 h-3" />
                            {formatTime(val)}
                          </span>
                        );
                      }
                      if (typeof val === 'string' || typeof val === 'number') {
                        return (
                          <span key={key} className="text-[11px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded">
                            {key}: {String(val).slice(0, 60)}
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
