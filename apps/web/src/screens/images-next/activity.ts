// The strip at the top reads the same build the Overview reads (UX-34, UX-19): the review build gives it the
// running image builds. The real console would read them from the live store like cache wipes.
import { useNow, type ActivityJob } from '@crsp/ui';
import { stepLine, timing, durationOf } from './words';
import type { ImagesOverview } from './model';
import { useGet } from './api';

export function useBuildActivity(): ActivityJob[] {
  const now = useNow();
  const { result } = useGet<ImagesOverview>('/api/v1/image-overview', true);
  if (result.state !== 'ready') return [];
  return result.data.builds
    .filter((b) => b.state === 'building')
    .map((b) => {
      const t = timing(b, now);
      return {
        id: `build:${b.id}`,
        label: `Building the job image on ${b.machine}, ${stepLine(b).toLowerCase()}`,
        value: t.pct,
        max: 100,
        left: `about ${durationOf(t.left)} left`,
      };
    });
}
