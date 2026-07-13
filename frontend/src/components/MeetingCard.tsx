import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckSquare, ChevronRight } from 'lucide-react';

interface MeetingCardProps {
  meetingId: string;
  numActionItems: number;
  hasActionFile: boolean;
  index: number;
}

export default function MeetingCard({ meetingId, numActionItems, hasActionFile, index }: MeetingCardProps) {
  const navigate = useNavigate();

  const dateMatch = meetingId.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch?.[1] || '';
  const name = meetingId.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-/g, ' ');

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={() => navigate(`/meetings/${meetingId}`)}
      className="w-full text-left bg-bg-card border border-border hover:border-accent/30 rounded-2xl p-5 transition-all duration-300 group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary truncate capitalize group-hover:text-accent-light transition-colors">
            {name}
          </h3>
          {dateStr && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs text-text-muted">{dateStr}</span>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-light transition-colors mt-1 shrink-0" />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs text-text-secondary">
            {numActionItems} action item{numActionItems !== 1 ? 's' : ''}
          </span>
        </div>
        {hasActionFile && (
          <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
            Filed
          </span>
        )}
      </div>
    </motion.button>
  );
}
