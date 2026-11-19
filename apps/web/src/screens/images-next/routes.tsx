// The routes of the proposed Images and caches section. They reach the console only through the `imagesRoutes` prop
// of App, which the review entry passes and the production entry does not.
import { Route } from 'react-router-dom';
import { AddRunnersBuildingPage } from './AddRunnersBuilding';
import { BuildPage } from './BuildPage';
import { CachePage } from './Caches';
import { ImagesHome } from './ImagesHome';
import { ProfilePage } from './Profiles';
import { ProfileWizardPage } from './ProfileWizard';
import { StackPage } from './Stacks';
import { RegistryBudgetsPage, RegistryImagePage } from './Registry';
import { RegistryReplacePage } from './RegistryReplace';

export const imagesNextRoutes = {
  tab: <Route path="images" element={<ImagesHome />} />,
  pages: (
    <>
      <Route path="pool/images/profiles/new" element={<ProfileWizardPage mode="new" />} />
      <Route path="pool/images/profiles/:id" element={<ProfilePage />} />
      <Route
        path="pool/images/profiles/:id/edit"
        element={<ProfileWizardPage mode="edit" />}
      />
      <Route path="pool/images/builds/:id" element={<BuildPage />} />
      <Route path="pool/images/stacks/:owner/:name" element={<StackPage />} />
      <Route
        path="pool/images/stacks/:owner/:name/confirm"
        element={<ProfileWizardPage mode="scan" />}
      />
      <Route path="pool/images/caches/:id" element={<CachePage />} />
      <Route path="pool/runners/add-building" element={<AddRunnersBuildingPage />} />
      <Route
        path="pool/runners/add-pulling"
        element={<AddRunnersBuildingPage mode="pull" />}
      />
      <Route path="pool/images/registry/budgets" element={<RegistryBudgetsPage />} />
      <Route path="pool/images/registry/:id" element={<RegistryImagePage />} />
      <Route path="pool/images/registry/:id/replace" element={<RegistryReplacePage />} />
    </>
  ),
};
