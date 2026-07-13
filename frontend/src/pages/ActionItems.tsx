import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ActionItems() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['action-items'],
    queryFn: () => api.listActionItems(),
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner label="Loading action items..." />
      </div>
    );
  }

  const items = query.data?.action_items || [];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Action Items</h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Filed action items from all meetings
        </p>
      </motion.div>

      {items.length === 0 ? (
        <EmptyState
          title="No action items filed"
          description="Run the agent on a meeting to file its action items here."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <motion.div
              key={item.meeting_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-bg-card border border-border rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigate(`/meetings/${item.meeting_id}`)}
                  className="flex items-center gap-2 group"
                >
                  <CheckSquare className="w-5 h-5 text-success" />
                  <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-light transition-colors">
                    {item.meeting_id}
                  </h3>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
              <div className="bg-bg-elevated rounded-xl border border-border-subtle p-4">
                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                  {item.content}
                </pre>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
