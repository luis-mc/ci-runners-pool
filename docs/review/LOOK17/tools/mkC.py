p='apps/web/src/screens/repositories/Repositories.tsx'
s=open(p).read()
# labels cell: each label is one unbreakable piece; Labels and Variables sort like their siblings (header row aligned)
s=s.replace("""    { id: 'labels', header: 'Labels', cell: (r) => r.policy.labels.join(', ') || 'none' },""","""    {
      id: 'labels',
      header: 'Labels',
      cell: (r) =>
        r.policy.labels.length ? (
          r.policy.labels.map((l) => (
            <span key={l} className="look-label">
              {l}
            </span>
          ))
        ) : (
          'none'
        ),
      sort: (r) => r.policy.labels.join(','),
    },""")
s=s.replace("""        return <Status kind={s.kind} word={s.word} />;
      },
    },
  ];""","""        return <Status kind={s.kind} word={s.word} />;
      },
      sort: (r) => variableStatus(r).word,
    },
  ];""",1)
a=s.index("                        <Table\n                          caption={`${g.owner} repositories`}")
end="inactive={(r) => publicWhileOff(r, enabled)}\n                        />"
b=s.index(end,a)+len(end)
table=s[a:b]
cards='''<ul className="look-cards" aria-label={`${g.owner} repositories (cards)`}>
                          {g.rows.map((r) => (
                            <li
                              key={r.id}
                              className="look-card"
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
                              <span className="look-card__name">
                                <TextLink to={`/repositories/${r.owner}/${r.name}`}>
                                  {r.name}
                                </TextLink>
                                <VisibilityCell r={r} inactive={publicWhileOff(r, enabled)} />
                              </span>
                              <dl className="look-card__facts">
                                {columns.slice(2).map((c) => (
                                  <div key={c.id}>
                                    <dt>{c.header}</dt>
                                    <dd>{c.cell(r)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </li>
                          ))}
                        </ul>'''
new='<div className="look-wide">\n'+table+'\n</div>\n'+cards
open(p,'w').write(s[:a]+new+s[b:])
