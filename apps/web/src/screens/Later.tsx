// The areas whose screens come in a later milestone (web-console 4.6..4.9). They keep their place in the menu
// and say so; no dead end (UX-6).
import { Empty, Page, PageHeader, TextLink } from '@crsp/ui';

export function Later({
  title,
  what,
  milestone,
}: {
  title: string;
  what: string;
  milestone: string;
}) {
  return (
    <Page>
      <PageHeader title={title} />
      <Empty
        title={`${what} arrives in ${milestone}. Until then the overview shows the queue and the running jobs.`}
        action={<TextLink to="/">Open the overview</TextLink>}
      />
    </Page>
  );
}

export function NotFound() {
  return (
    <Page>
      <PageHeader title="Page not found" />
      <Empty
        title="This page does not exist."
        action={<TextLink to="/">Open the overview</TextLink>}
      />
    </Page>
  );
}
