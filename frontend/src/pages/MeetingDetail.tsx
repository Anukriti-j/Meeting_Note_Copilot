import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Bot,
  FileText,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function MeetingDetail() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const meetingQuery = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => api.getMeeting(meetingId!),
    enabled: !!meetingId,
  });

  const agentMutation = useMutation({
    mutationFn: () => api.runAgent(meetingId!, true),
    onSuccess: () => {
      toast.success('Agent completed');
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (meetingQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner label="Loading meeting..." />
      </div>
    );
  }

  if (!meetingQuery.data) {
    return (
      <EmptyState
        title="Meeting not found"
        description="This meeting doesn't exist in the vector store."
      />
    );
  }

  const { meeting_id, action_items, action_file } = meetingQuery.data;
  const dateMatch = meeting_id.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch?.[1] || 'Unknown date';
  const displayName = meeting_id.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-/g, ' ');

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight capitalize">
              {displayName}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{dateStr}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted">
                <CheckSquare className="w-4 h-4" />
                <span className="text-sm">{action_items.length} action items</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => agentMutation.mutate()}
            disabled={agentMutation.isPending || action_items.length === 0}
            className="flex items-center gap-2 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl transition-all duration-200 text-sm"
          >
            <Bot className="w-4 h-4" />
            {agentMutation.isPending ? 'Running Agent...' : 'Run Agent'}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Items */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <CheckSquare className="w-5 h-5 text-warning" />
            <h2 className="text-base font-semibold text-text-primary">Action Items</h2>
          </div>
          {action_items.length === 0 ? (
            <p className="text-sm text-text-muted py-4">No action items for this meeting.</p>
          ) : (
            <ul className="space-y-3">
              {action_items.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-start gap-3 p-3 bg-bg-elevated rounded-xl border border-border-subtle"
                >
                  <div className="w-5 h-5 mt-0.5 rounded-md border-2 border-border flex-shrink-0" />
                  <span className="text-sm text-text-secondary leading-relaxed">{item}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Filed Status / Agent Output */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <FileText className="w-5 h-5 text-success" />
            <h2 className="text-base font-semibold text-text-primary">Filed Output</h2>
          </div>
          {action_file ? (
            <div className="bg-bg-elevated rounded-xl border border-border-subtle p-4">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                {action_file}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">
                Run the agent to file action items
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Agent Result */}
      {agentMutation.data && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-accent/20 glow-accent rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-accent-light" />
            <h3 className="text-base font-semibold text-text-primary">Agent Result</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{agentMutation.data.result}</p>
        </motion.div>
      )}
    </div>
  );
}
