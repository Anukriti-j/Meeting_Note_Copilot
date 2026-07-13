export default function LoadingSpinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const px = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${px} border-2 border-border border-t-accent rounded-full animate-spin`} />
      {label && <p className="text-sm text-text-secondary animate-pulse">{label}</p>}
    </div>
  );
}
