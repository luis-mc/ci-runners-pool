// Sign-in page (web-console 4.1): signed out, signing in, failed, no access (R5.8..R5.10).
import { Button, Message, Page, PageHeader, Stack, Text, TextLink } from '@crsp/ui';
import { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { unwrap, useClient } from '../api/api';
import { useLoad } from '../api/hooks';
import { signInUrl, safeReturnPath, useSession } from './session';

export function SignInPage() {
  const session = useSession();
  const client = useClient();
  const [params] = useSearchParams();
  const location = useLocation();
  const [starting, setStarting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;
  const returnTo = safeReturnPath(params.get('return_to') ?? from);
  const failed = params.get('error');
  const { result: setup } = useLoad(() => unwrap(client.GET('/api/v1/setup')), []);

  if (session.state.status === 'ready') return <Navigate to={returnTo} replace />;

  if (session.state.status === 'no-access') {
    const login = session.state.login;
    return <NoAccess login={login} onSignOut={() => void session.signOut()} />;
  }

  const noApp = setup.state === 'ready' && !setup.data.has_app;

  return (
    <main>
      <Page frame="narrow">
        <PageHeader title="Sign in" lead="CI Runners Shared Pool" />
        {failed === 'link_expired' || failed === 'link_local_only' ? (
          <Message tone="problem">
            {failed === 'link_expired'
              ? 'The sign-in link from the tray expired or was already used. Choose Open in the tray again, or sign in with GitHub.'
              : 'The sign-in link from the tray works on the computer that made it only. Sign in with GitHub here.'}
          </Message>
        ) : failed ? (
          <Message tone="problem">
            Sign-in failed. GitHub did not let you in ({failed}). Try again.
          </Message>
        ) : null}
        {noApp ? (
          <Message tone="needs-you">
            This controller has no GitHub App yet. Open the setup page to create it.
          </Message>
        ) : null}
        <Stack>
          <Text>Sign in with the GitHub account the owner allowed.</Text>
          <Button
            kind="primary"
            busy={starting}
            busyLabel="Signing in"
            disabled={noApp}
            reason={noApp ? 'Create the GitHub App first.' : undefined}
            onPress={() => {
              setStarting(true);
              window.location.assign(signInUrl(returnTo));
            }}
          >
            Sign in with GitHub
          </Button>
          {noApp ? <TextLink to="/setup">Open the setup page</TextLink> : null}
        </Stack>
      </Page>
    </main>
  );
}

export function NoAccess({ login, onSignOut }: { login: string; onSignOut: () => void }) {
  return (
    <main>
      <Page frame="narrow">
        <PageHeader title="No access" />
        <Message tone="needs-you">
          Signed in as {login || 'this account'}. This GitHub account has no access. Ask
          the owner to add it.
        </Message>
        <Button kind="primary" onPress={onSignOut}>
          Sign out
        </Button>
      </Page>
    </main>
  );
}
