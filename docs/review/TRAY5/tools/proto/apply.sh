#!/usr/bin/env bash
# Applies the prototype of one option (A, B or C) to the working tree. Review use only: never commit the result.
set -euo pipefail
opt=$1
here=$(cd "$(dirname "$0")" && pwd)
root=$(git rev-parse --show-toplevel)
src=$root/apps/web/src
mkdir -p "$src/proto"
sed "s/__OPT__/$opt/" "$here/Chrome.tsx" > "$src/proto/Chrome.tsx"
cp "$here/Installer.tsx" "$src/proto/Installer.tsx"
cp "$here/$(echo "$opt" | tr A-Z a-z).css" "$src/proto/proto.css"
cp "$here/crsp-icon.png" "$root/apps/web/public/crsp-icon.png"
python3 - "$root" "$opt" <<'PY'
import sys,re
root,opt=sys.argv[1:3]
p=root+'/apps/web/'
def sub(f,a,b,cnt=1):
    t=open(p+f).read(); assert a in t,(f,a); open(p+f,'w').write(t.replace(a,b,cnt))
sub('index.html','<title>','<link rel="icon" type="image/png" href="/crsp-icon.png" />\n    <title>')
sub('src/main.tsx',"import '@crsp/ui/ui.css';","import '@crsp/ui/ui.css';\nimport './proto/proto.css';")
sub('src/App.tsx',"import { UpdateCompactPage,","import { InstallerPage } from './proto/Installer';\nimport { UpdateCompactPage,")
sub('src/App.tsx','<Route path="/setup" element={<SetupPage />} />','<Route path="/setup" element={<SetupPage />} />\n              <Route path="/installer" element={<InstallerPage />} />')
sub('src/screens/settings/Updates.tsx',"import { Load } from '../common';","import { Load } from '../common';\nimport { OPT, Proto } from '../../proto/Chrome';")
sub('src/screens/settings/Updates.tsx','''    <main>
      <Page frame="compact">
        <PageHeader title="Update" />
        <UpdateWizard compact />
      </Page>
    </main>''','''    <Proto title="Update">
      <main>
        <Page frame="compact">
          <UpdateWizard compact />
        </Page>
      </main>
    </Proto>''')
sub('src/screens/settings/Updates.tsx','`Updated to ${status?.current_version}.`','`Now running ${status?.current_version}.`')
if opt=='B':
    sub('src/screens/settings/Updates.tsx',"""  'Waiting for jobs',
  'Installing',
  'Restarting',""","""  'Jobs',
  'Install',
  'Restart',""")
    sub('src/screens/settings/Updates.tsx',"  'Downloading',\n  'Jobs'","  'Download',\n  'Jobs'")
if opt!='B':
    pass
PY
