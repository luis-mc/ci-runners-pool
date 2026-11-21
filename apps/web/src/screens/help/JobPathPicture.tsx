// The picture of how a job gets run (LOOK44): the Help page draws it with a jump to the cards, the first-run Overview reads it.
import { JobPath } from '@crsp/ui';
import { PATH_GROUPS, PATH_PARTS } from './helpContent';

export function JobPathPicture({
  lit,
  onSelect,
}: {
  lit?: readonly string[] | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  return (
    <JobPath
      label="How a job gets run"
      groups={PATH_GROUPS}
      parts={PATH_PARTS}
      lit={lit}
      onSelect={onSelect}
    />
  );
}
