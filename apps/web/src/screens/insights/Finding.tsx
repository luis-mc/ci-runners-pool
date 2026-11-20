// Run insights, one finding (spec 4.1): the headline in words, the fix, a copyable snippet, the evidence as a
// table, the estimate and first and last seen. A fix that changes the crsp setup has one primary, Review the change
// (UX-4, UX-71); a fix in a repository has none (UX-8). There is no dismiss button (R5.45).
import {
  ActionBar,
  Breadcrumbs,
  CodeBlock,
  ExternalButton,
  Facts,
  LinkButton,
  Page,
  PageHeader,
  Section,
  Stack,
  Table,
  Text,
  formatShortDateTime,
  type Column,
} from '@crsp/ui';
import { useParams } from 'react-router-dom';
import { Load } from '../common';
import { useFinding } from './api';
import { AREA_WORDS, minutesWords, projectOf, type Finding } from './words';

interface Evidence {
  name: string;
  value: string;
}

const evidenceRows = (f: Finding): Evidence[] =>
  Object.entries(f.evidence).map(([name, value]) => ({
    name: name.replaceAll('_', ' '),
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }));

const evidenceColumns: Column<Evidence>[] = [
  { id: 'name', header: 'What was measured', cell: (e) => e.name, sort: (e) => e.name },
  { id: 'value', header: 'Value', cell: (e) => e.value, kind: 'grow', grow: 2 },
];

export const changePath = (f: Pick<Finding, 'id'>): string =>
  `/jobs/insights/finding/${f.id}/change`;

export function FindingPage() {
  const { id } = useParams();
  const { result, reload } = useFinding(Number(id));
  return (
    <Page>
      <Load result={result} what="this finding" reload={reload}>
        {(f) => (
          <>
            <Breadcrumbs
              trail={[
                { label: 'Jobs', to: '/jobs' },
                { label: 'Run insights', to: '/jobs/insights' },
                { label: f.title },
              ]}
            />
            <PageHeader title={f.title} lead={`${projectOf(f)}, ${AREA_WORDS[f.area]}`} />
            <Stack>
              <Section title="The fix">
                <Text>{f.fix}</Text>
                {f.snippet ? (
                  <CodeBlock text={f.snippet} label="Workflow snippet" />
                ) : null}
              </Section>
              <Section title="Evidence">
                <Table
                  caption="Evidence"
                  columns={evidenceColumns}
                  rows={evidenceRows(f)}
                  rowKey={(e) => e.name}
                />
              </Section>
              <Section title="Estimate">
                <Facts
                  items={[
                    {
                      name: 'Saves',
                      value: `${minutesWords(f.minutes_saved_week)} (estimate)`,
                    },
                    { name: 'First seen', value: formatShortDateTime(f.first_seen) },
                    { name: 'Last seen', value: formatShortDateTime(f.last_seen) },
                  ]}
                />
              </Section>
            </Stack>
            <ActionBar
              primary={
                f.action_kind ? (
                  <LinkButton to={changePath(f)} kind="primary">
                    Review the change
                  </LinkButton>
                ) : f.repository ? (
                  <ExternalButton href={`https://github.com/${f.repository}`}>
                    Open the workflow on GitHub
                  </ExternalButton>
                ) : (
                  <LinkButton to="/jobs/insights">Back to Do next</LinkButton>
                )
              }
            />
          </>
        )}
      </Load>
    </Page>
  );
}
