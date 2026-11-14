---
change: minor
task: CRSP17
---
The API table maps to the M1 contract as follows: the pool switch is planRepositoryChanges and applyRepositoryChanges (POST /api/v1/repository-plans, then /apply) so turning the pool off names the variables first (R5.29); the policy is read in getRepository and changed with updateRepositoryPolicy (PATCH); the device flow adds getCliLoginConfig, listCliTokens and revokeCliToken; startSignIn takes bind_tray for the tray binding. The x-auth vocabulary is public, user, admin, owner (viewer is user).
