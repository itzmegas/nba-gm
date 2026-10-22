This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Disposable database schema

For a fresh disposable Supabase project, run `scripts/schema.sql`. For an existing disposable
project that already has migrations 013-015, apply `scripts/migrations/016_rollback_seed_game_data.sql`.
Do not run either instruction against the main database; this change has not performed live writes.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Pull request checks

Use Bun 1.3.13 (pinned in `package.json`). GitHub Actions runs the `Quality` job on
every pull request and on pushes to `develop` and `main`:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
```

Type checking generates Next.js route types first, so it works on a fresh checkout.
Tests use Vitest, not Bun's built-in test runner. The CI build uses dummy Supabase
values and does not need repository secrets, a live database, or schema changes.
It checks compilation and prerendering, not live authentication or database behavior.

### Make checks required before merging

The workflow alone does not block merging. After pushing this workflow and seeing
its first successful pull request run:

1. Open **Settings → Rules → Rulesets** in GitHub.
2. Edit the ruleset protecting the target branch and enable **Require status checks
   to pass**, selecting the `Quality` check from GitHub Actions.
3. Enable **Require branches to be up to date before merging**. Keep required
   approvals at zero while there is only one maintainer.

Both existing rulesets (`Protect Main` and `Protect develop`) currently target the
default branch, `develop`. Verify their branch targets before configuring production
protection; the name `Protect Main` does not mean it protects `main`.

### Deployment

No hosting provider or deployment workflow is configured yet. Keep deployment and
database migrations out of pull request CI. When hosting is connected, configure
the real public Supabase environment variables there, keep privileged keys
server-only, and gate production deployment on successful CI.
