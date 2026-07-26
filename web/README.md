# Open Bible Assessment

The Next.js frontend for Open Bible Assessment. It provides adaptive Old and
New Testament assessments, BLI dashboards, focused retests, recent-answer
review, knowledge maps, and the internal question-quality console.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and supply the project values.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run build
```

## Deployment

Production is deployed through Vercel:

```bash
npx vercel --prod
```

See `COLLABORATING.md` for the repository-sharing and environment setup notes.
