// Old addresses of Machines, Runners and Images and caches (D24, LOOK31): each goes to its place in
// Shared Pool and keeps the query and the hash, so a bookmark, the setup banner and a stored plan (?plan=) still work.
import { Navigate, useLocation, useParams } from 'react-router-dom';

/** `to` may hold `:name` parts; they are filled from the address. */
export function MovedTo({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const path = to.replace(/:(\w+)/g, (_, k: string) =>
    encodeURIComponent(params[k] ?? ''),
  );
  return <Navigate to={`${path}${search}${hash}`} replace />;
}

/** Every old address and where it goes. */
export const MOVED: readonly (readonly [from: string, to: string])[] = [
  ['machines', '/pool/machines'],
  ['machines/add', '/pool/machines/add'],
  ['machines/:id', '/pool/machines/:id'],
  ['runners', '/pool/runners'],
  ['runners/add', '/pool/runners/add'],
  ['images', '/pool/images'],
  ['images/:imageId', '/pool/images/:imageId'],
  ['caches', '/pool/images?tab=caches'],
];
