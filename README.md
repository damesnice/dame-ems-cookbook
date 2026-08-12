# Dame and Ems' Cookbook

A cookbook that keeps evolving — log a recipe, cook it again with changes,
and watch a family tree of every version build itself.

## 1. Run it locally first (optional but recommended)

You need [Node.js](https://nodejs.org) installed (any recent LTS version).

```bash
cd dame-ems-cookbook
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Confirm the icon,
header photo, and recipes all work before you push anything.

## 2. Push to GitHub

If you don't have a repo yet, create an empty one on github.com first
(no README/license — just an empty repo), then:

```bash
cd dame-ems-cookbook
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

Replace `YOUR-USERNAME/YOUR-REPO-NAME` with your actual GitHub repo path.

## 3. Deploy to Vercel

**Easiest way (recommended):**
1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click "Add New" → "Project".
3. Select the repo you just pushed.
4. Vercel auto-detects Vite — leave the defaults as-is.
5. Click "Deploy". You'll get a live URL like `dame-ems-cookbook.vercel.app`
   within about a minute.

**Or via the command line, if you'd rather not open the browser:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

## 4. Install it like an app

Once deployed, open the Vercel URL on your phone:
- **iPhone**: open the link in Safari → Share → Add to Home Screen.
- **Android**: open the link in Chrome → you should get an "Install app"
  banner automatically, or use the ⋮ menu → Install app.

Because this is now a real hosted address (not a local file), the icon and
your saved recipes will behave consistently every time — the caching quirks
we ran into with the local file version are specific to `file://` pages and
won't happen here.

## Notes

- **Data storage**: recipes are saved in the browser's local storage, tied
  to the device and browser you're using. Two different phones will have
  two separate cookbooks.
- **Back up your recipes**: use the "back up recipes" link at the bottom of
  the shelf to download a `.json` file, and "restore from backup" to load
  it back in (handy for moving recipes to another device, or before
  clearing your browser data).
- **Making changes later**: edit the files, then just `git add . && git
  commit -m "..." && git push` — Vercel redeploys automatically on every
  push to `main`.
