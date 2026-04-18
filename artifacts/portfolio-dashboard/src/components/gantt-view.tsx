import { useGetProjectsTimeline } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval, differenceInDays } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-500",
  in_progress: "bg-blue-500",
  up_next: "bg-indigo-400",
  backlog: "bg-slate-400",
  blocked: "bg-red-500",
  new_request: "bg-purple-400",
};

export default function GanttView() {
  const currentYear = new Date().getFullYear();
  const { data: projects, isLoading } = useGetProjectsTimeline({ year: currentYear });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full rounded-xl" />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20">
        <p className="text-muted-foreground text-sm">No timeline data available for {currentYear}</p>
      </div>
    );
  }

  // Filter out projects without dates
  const timelineProjects = projects.filter(p => p.startDate && p.endDate);
  
  if (timelineProjects.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20">
        <p className="text-muted-foreground text-sm">No projects have dates scheduled for {currentYear}</p>
      </div>
    );
  }

  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  const yearEnd = endOfYear(yearStart);
  const totalDays = differenceInDays(yearEnd, yearStart);
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  // Calculate percentage left/width for a bar
  const getBarPosition = (start: string, end: string) => {
    const sDate = Math.max(parseISO(start).getTime(), yearStart.getTime());
    const eDate = Math.min(parseISO(end).getTime(), yearEnd.getTime());
    
    if (sDate > yearEnd.getTime() || eDate < yearStart.getTime()) {
      return null; // Out of bounds
    }

    const left = (differenceInDays(new Date(sDate), yearStart) / totalDays) * 100;
    const width = (differenceInDays(new Date(eDate), new Date(sDate)) / totalDays) * 100;
    
    return { left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` };
  };

  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <div className="min-w-[800px] p-4">
        <div className="flex mb-4 relative ml-[250px] border-b pb-2">
          {months.map((month, i) => (
            <div key={i} className="flex-1 text-xs font-medium text-muted-foreground text-center border-l first:border-l-0 border-border/50">
              {format(month, 'MMM')}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {timelineProjects.map(project => {
            const pos = getBarPosition(project.startDate!, project.endDate!);
            if (!pos) return null;

            return (
              <div key={project.id} className="flex items-center group relative hover:bg-muted/20 -mx-4 px-4 py-1 rounded">
                <div className="w-[240px] shrink-0 pr-4">
                  <div className="text-sm font-medium truncate" title={project.title}>{project.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{project.team || "No team"}</div>
                </div>
                
                <div className="flex-1 relative h-8 bg-muted/10 rounded overflow-hidden">
                  <div 
                    className={`absolute top-1 bottom-1 rounded-sm shadow-sm opacity-90 hover:opacity-100 transition-opacity ${STATUS_COLORS[project.status] || 'bg-slate-400'}`}
                    style={{ left: pos.left, width: pos.width }}
                    title={`${project.title}\n${format(parseISO(project.startDate!), 'MMM d, yyyy')} - ${format(parseISO(project.endDate!), 'MMM d, yyyy')}`}
                  >
                    {/* Add a tiny darker strip at bottom of bar for 3d effect */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-sm" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
