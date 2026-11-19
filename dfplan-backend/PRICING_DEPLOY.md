# Deploy the SGD pricing rules

The frontend has a reference table until an administrator publishes rates. Formal shared editing requires these additive rules; Patrick, other guests and demo users remain read-only.

Open Google Cloud Shell as the existing protected owner. In the repository directory:

```sh
git fetch origin main
git switch main
git pull --ff-only origin main
npm ci --prefix dfplan-backend --omit=dev
node dfplan-backend/scripts/deploy-pricing-rules.mjs
```

Stop if Git reports local changes or a branch conflict; preserve those changes first. Expected result: `DFPLAN_PRICING_RULES_READY`. The script checks the exact live rules against the reviewed baseline, preserves all prior rule logic and reads/writes no family records. It never initializes tasks, people or administrators.

Then sign in to `/dfplan/#digitization` with the existing Google administrator account, refresh the shared rates, review the reference allocation, enter a change reason and publish the first version. Confirm the page shows revision 1. Reopen as Patrick to verify the table has no editing form.

Initial rates are planning allocations, not historical approved prices: documents S$2/page, photos S$8/image, audio S$2/minute, video S$10/minute, setup/QA S$1,200/project and minimum total S$8,000. Rates are stored as integer SGD cents with immutable version records. Task and people records are separate.
