# Collaborating on Open Bible School

This app lives in the `web/` folder.

## First-time setup

```bash
git clone https://github.com/stamper13/open-bible-school.git
cd open-bible-school/web
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Fill in `.env.local` with the real Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Do not commit `.env.local`.

## Updating your local copy

```bash
git pull
cd web
npm install
npm run dev
```

## Sharing a quick live preview

When the dev server is running locally:

```bash
npx localtunnel --port 3000
```

Send the generated URL to a collaborator for a temporary preview.
