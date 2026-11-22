# Changesets

Each pull request that changes what users get adds one file here: run `pnpm changeset`, pick
`patch`, `minor` or `major`, and write the line for the changelog the way a user should read it.
Both packages always release together, under one version number.

When changesets reach `main`, the release workflow opens (or updates) a "Version packages" pull
request. Merging that one publishes. See CONTRIBUTING.md.
