p='apps/web/src/screens/repositories/Repositories.tsx'
s=open(p).read()
a=s.index("                        <Table\n                          caption={`${g.owner} repositories`}")
end_marker="inactive={(r) => publicWhileOff(r, enabled)}\n                        />"
b=s.index(end_marker,a)+len(end_marker)
new='''                        <ul className="look-rows" aria-label={`${g.owner} repositories`}>
                          <li className="look-rows__head" aria-hidden="true">
                            <span />
                            <span>Repository</span>
                            <span>Pool</span>
                            <span>Jobs go to</span>
                          </li>
                          {g.rows.map((r) => (
                            <li
                              key={r.id}
                              className="look-rows__row"
                              data-list-row
                              data-inactive={publicWhileOff(r, enabled) || undefined}
                            >
                              <input
                                type="checkbox"
                                className="ds-checkbox"
                                checked={selected.has(String(r.id))}
                                aria-label={`Select ${r.full_name}`}
                                onChange={() =>
                                  setPicked((p) => {
                                    const n = new Set(p);
                                    if (n.has(r.id)) n.delete(r.id);
                                    else n.add(r.id);
                                    return n;
                                  })
                                }
                              />
                              <span className="look-rows__name">
                                <TextLink to={`/repositories/${r.owner}/${r.name}`}>
                                  {r.name}
                                </TextLink>
                                {r.visibility !== 'private' || r.problem ? (
                                  <VisibilityCell
                                    r={r}
                                    inactive={publicWhileOff(r, enabled)}
                                  />
                                ) : null}
                              </span>
                              <span className="look-rows__pool">
                                <Status
                                  kind={r.pool_on ? 'ok' : 'off'}
                                  word={r.pool_on ? 'on' : 'off'}
                                />
                              </span>
                              <span className="look-rows__where">
                                <WhereJobsGo r={r} />
                              </span>
                              <span className="look-rows__details">
                                {[
                                  `labels: ${r.policy.labels.join(', ') || 'none'}`,
                                  `${r.policy.max_parallel_jobs} parallel`,
                                  `priority ${r.policy.priority}`,
                                  `last delivery: ${r.pool_on ? deliveryStatus(r).word : 'pool off'}`,
                                  variableStatus(r).word,
                                ].join(' · ')}
                              </span>
                            </li>
                          ))}
                        </ul>'''
open(p,'w').write(s[:a]+new+s[b:])
