# Running on Replit

This project keeps its existing pnpm workspace structure.

## Application workflow

Run `bash scripts/replit-dev.sh`.

- The Express API runs internally on port 3000.
- Vite serves the dashboard on `0.0.0.0:5000`, the Replit webview port.
- Vite proxies `/api` and `/attachments` to the internal API.
- The app uses Replit's built-in PostgreSQL database through `DATABASE_URL`.

## First-time setup

Install dependencies with `pnpm install`, then apply the development schema with:

```bash
pnpm --filter @workspace/db run push
```

Editor login requires the `TD_ADMIN_ACCOUNTS` and `TD_ADMIN_SESSION_SECRET`
secrets. `BASE_PATH=/` and `VITE_API_BASE_URL=http://127.0.0.1:3000` are shared
environment variables configured for development.