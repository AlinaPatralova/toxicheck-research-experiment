# Independent Research Deployment

Configuration is prepared, but no hosting project has been created or linked.
The previous `/api` proxy to the product backend was removed in this repository
only. `vercel.json` now builds a static SPA with relative fallback routing.

## New Vercel Project

1. Publish this repository to the new research GitHub origin first.
2. In Vercel, create a NEW project named `toxicheck-research-experiment` and import
   ONLY the new repository. Do not edit, relink, or reuse the ToxiCheck product project.
3. Root directory: repository root. Framework: Vite. Node.js: 24.x.
4. Install command: `npm ci`. Build command: `npm run build`. Output: `dist`.
5. Set the research project's production branch to `main`; keep `dev` as preview.
   Here "production" means the stable research deployment, not the ToxiCheck product.
6. Do not import production environment variables, secrets, domains, storage,
   integrations, analytics, Railway services, or an existing `.vercel` directory.
7. Use a NEW research domain/subdomain. Never reuse the product domain.
8. Check `/`, `/research`, direct route refresh, Flat/Hybrid training, confirmation,
   abandonment, JSON/CSV export, and the mobile fixed footer on the new deployment.
9. In the browser Network panel, verify there are no requests to the product backend
   or product API. Google Fonts is an intentional pre-existing font request.
10. Give participants only the stable main deployment URL, not dev/PR preview URLs.

There is no server-side database or central collection endpoint. Store exported
research data securely outside Git. Origins have separate localStorage, so select
the final domain before participant assignment and collection. A source deployment
does not migrate browser data from the local prototype.

Do not run `vercel --prod` from a directory linked to the product project. A future
Vercel CLI link must explicitly select/create only the NEW research project.

Official reference: [Vercel Git deployments and branch environments](https://vercel.com/docs/git).
