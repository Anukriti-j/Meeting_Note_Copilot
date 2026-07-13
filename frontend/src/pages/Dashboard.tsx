import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Database, FileText, MessageCircle, Zap, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import MeetingCard from '../components/MeetingCard';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
  const queryClient = useQueryClient();

  const meetingsQuery = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.listMeetings(),
  });

  const actionItemsQuery = useQuery({
    queryKey: ['action-items'],
    queryFn: () => api.listActionItems(),
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seed(),
    onSuccess: (data) => {
      toast.success(`Seeded ${data.seeded} meetings`);
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const meetings = meetingsQuery.data?.meetings || [];
  const actionFiles = actionItemsQuery.data?.action_items || [];
  const totalActionItems = meetings.reduce((sum, m) => sum + m.num_action_items, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Dashboard
        </h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Overview of your meeting intelligence system
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Meetings"
          value={meetings.length}
          color="text-accent-light"
          delay={0}
        />
        <StatCard
          icon={Zap}
          label="Action Items"
          value={totalActionItems}
          color="text-warning"
          delay={0.05}
        />
        <StatCard
          icon={Database}
          label="Filed"
          value={actionFiles.length}
          color="text-success"
          delay={0.1}
        />
        <StatCard
          icon={MessageCircle}
          label="Vector Store"
          value={meetings.length > 0 ? 'Active' : 'Empty'}
          color="text-info"
          delay={0.15}
        />
      </div>

      {/* Meetings Grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">Recent Meetings</h2>
          {meetings.length > 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-hover hover:bg-bg-card border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
              Re-seed
            </button>
          )}
        </div>

        {meetings.length === 0 ? (
          <EmptyState
            title="No meetings yet"
            description="Seed sample data or ingest your first meeting recording to get started."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map((m, i) => (
              <MeetingCard
                key={m.meeting_id}
                meetingId={m.meeting_id}
                numActionItems={m.num_action_items}
                hasActionFile={m.has_action_file}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
