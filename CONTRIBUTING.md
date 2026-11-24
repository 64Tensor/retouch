# Contributing to Rétouch

Thanks for helping. Bugs and ideas go in [issues](https://github.com/64Tensor/retouch/issues);
for anything bigger than a fix, open an issue first so we can agree on the shape before you
write it. Security problems don't go in issues: see [SECURITY.md](SECURITY.md).

## Setting up

You need [pnpm](https://pnpm.io) 12 (`npm install -g pnpm@12`). Installing also downloads the
Node version the repository pins (`devEngines` in `package.json`), for this repository alone.

```bash
pnpm install
pnpm dev              # the playground at http://localhost:5173, reloading as you edit
pnpm test             # Vitest + jsdom, both packages (test:watch, test:coverage)
pnpm typecheck        # TypeScript, both packages and their tests
pnpm check            # Biome lint and format check (pnpm format fixes what it can)
pnpm build            # both packages into their dist/
pnpm smoke            # pack both packages and check what npm would get
pnpm verify           # all of the above, in the order CI runs them
```

## Layout

```
packages/retouch/     @64tensor/retouch: src/, tests/, docs/ (shipped in the package)
packages/ml/          @64tensor/retouch-ml: src/, tests/, the model notices
playground/           a bare page that mounts the editor, for development
desktop/              Rétouch for the Mac (Electron): see desktop/README.md
scripts/smoke.mjs     the packed-tarball checks; scripts/sync-version.mjs keeps VERSION in step
.changeset/           pending changelog entries
```

Inside the repository, each package's `exports` point at its TypeScript source, so the tests,
the playground and the ML package all run against the source with no build step. The
`publishConfig` in each package.json swaps in `dist/` when the package is packed or published,
and `pnpm smoke` checks that it did.

The full demo, with sample photos, lives at [retouch.64tensor.com](https://retouch.64tensor.com).
It isn't in this repository: it installs the published packages from npm like any other app, so
a release that would break a real user breaks there too.

## Making a change

1. Branch from `main`, and keep the change to one thing.
2. Add or update tests beside the code. `pnpm verify` should pass before you open a pull request;
   CI runs the same.
3. If users will notice the change, run `pnpm changeset`. Pick `patch` for a fix, `minor` for
   something new, `major` for anything that breaks an existing app, and write the changelog line
   for the person upgrading. Docs-only and internal changes don't need one.

## How releases happen

Nobody publishes from a laptop.

1. Changesets merged to `main` collect in a "Version packages" pull request, which
   `.github/workflows/release.yml` keeps up to date. It bumps both packages to the same version,
   writes the changelog entries, and updates `VERSION` in `packages/retouch/src/constants.ts`.
2. Merging that pull request runs the workflow again: `pnpm verify`, then `changeset publish`
   publishes both packages to npm through
   [trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub's OIDC token, so no
   npm token is stored anywhere), with provenance. It tags the release and writes a GitHub
   release from the changelog.

GitHub doesn't run other workflows on pull requests opened by a workflow, so CI doesn't run on
"Version packages" itself. The release workflow runs `pnpm verify` before it publishes instead.

CI and releases run on GitHub's own runners. Never attach a self-hosted runner to this
repository: anyone can open a pull request from a fork, and it would run on that machine.

### One-time setup, before the first release

These need the account owner, once:

1. **npm:** create the `@64tensor` organization. npm only lets you set up trusted publishing on a
   package that already exists, so publish 0.3.0 of both packages by hand the first time, from a
   clean checkout of `main`, signed in with two-factor authentication:
   `pnpm verify && pnpm --filter "./packages/*" publish --access public`.
   (`pnpm publish` rewrites `workspace:^` to the real version range; `npm publish` wouldn't.)
2. **npm, for each package:** Settings → Trusted publishing → GitHub Actions, with repository
   `64Tensor/retouch`, workflow `release.yml` and environment `npm`. Then, under publishing
   access, require two-factor authentication and disallow tokens, so trusted publishing is the
   only way in.
3. **GitHub:** create the `npm` environment (Settings → Environments). Add yourself as a required
   reviewer if every release should wait for a click. Under Actions → General, allow GitHub
   Actions to create pull requests. Turn on private vulnerability reporting under Security.
