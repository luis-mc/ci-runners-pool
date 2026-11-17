import re,sys
p='apps/web/src/screens/repositories/Repositories.tsx'
s=open(p).read()
a=s.index("  const columns: Column<Repository>[] = [")
b=s.index("  return (\n    <Page>", a)
new='''  const columns: Column<Repository>[] = [
    {
      id: 'name',
      header: 'Repository',
      cell: (r) => (
        <Stack gap="tight">
          <Text>
            <TextLink to={`/repositories/${r.owner}/${r.name}`}>{r.name}</TextLink>
            {r.visibility !== 'private' || r.problem ? (
              <>
                {' '}
                <VisibilityCell r={r} inactive={publicWhileOff(r, enabled)} />
              </>
            ) : null}
          </Text>
          <Text tone="muted">
            {`${r.policy.max_parallel_jobs} parallel · priority ${r.policy.priority} · ${variableStatus(r).word}`}
          </Text>
        </Stack>
      ),
      sort: (r) => r.name,
    },
    {
      id: 'pool',
      header: 'Pool',
      cell: (r) => (
        <Status kind={r.pool_on ? 'ok' : 'off'} word={r.pool_on ? 'on' : 'off'} />
      ),
      sort: (r) => String(r.pool_on),
    },
    {
      id: 'where',
      header: 'Jobs go to',
      cell: (r) => <WhereJobsGo r={r} />,
      sort: (r) => r.routing?.where ?? '',
    },
    {
      id: 'delivery',
      header: 'Last delivery',
      cell: (r) =>
        r.pool_on ? (
          <DeliveryStatus r={r} />
        ) : (
          <Status
            kind="off"
            word={
              r.pool_off_reason === 'left_installation'
                ? 'left the installation'
                : 'pool off'
            }
          />
        ),
      sort: (r) => r.webhook?.last_delivery_at ?? '',
    },
  ];

'''
open(p,'w').write(s[:a]+new+s[b:])
