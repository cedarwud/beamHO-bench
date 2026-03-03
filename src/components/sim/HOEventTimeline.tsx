import type { HOEvent } from '@/sim/types';

export interface HOEventTimelineRow extends HOEvent {
  timeSec: number;
}

interface HOEventTimelineProps {
  events: HOEventTimelineRow[];
  maxRows?: number;
}

export function HOEventTimeline({ events, maxRows = 10 }: HOEventTimelineProps) {
  const rows = events.slice(-maxRows).reverse();
  return (
    <div className="sim-ho-timeline" aria-live="polite">
      <div className="sim-ho-timeline__header">HO Event Timeline</div>
      {rows.length === 0 ? (
        <div className="sim-ho-timeline__empty">No events captured yet.</div>
      ) : (
        <div className="sim-ho-timeline__list">
          {rows.map((row, index) => (
            <div key={`${row.tick}-${row.ueId}-${index}`} className="sim-ho-timeline__row">
              <span className="sim-ho-timeline__time">t={row.timeSec.toFixed(1)}s</span>
              <span className="sim-ho-timeline__tick">tick={row.tick}</span>
              <span className="sim-ho-timeline__ue">UE {row.ueId}</span>
              <span className="sim-ho-timeline__path">
                {row.fromSatId ?? '-'}:{row.fromBeamId ?? '-'} {'->'} {row.toSatId ?? '-'}:
                {row.toBeamId ?? '-'}
              </span>
              <span className="sim-ho-timeline__reason">{row.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
