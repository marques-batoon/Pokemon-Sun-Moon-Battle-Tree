# Battle Tree relay (online Multi Battles)

A tiny Cloudflare Worker that lets two players of the app team up in an online
Multi Battle. It only passes messages between the two players of a room. The
battle itself runs in the browser of the player who made the room (the host).

- **Free:** fits Cloudflare's Workers Free plan (no card needed). One room is one
  Durable Object (SQLite-backed, which the free plan includes).
- **No accounts, no stored data, no logs:** rooms live in memory and disappear when
  both players leave (or after 6 hours). `observability` is off in `wrangler.toml`.
- **Players never connect to each other directly,** so neither sees the other's IP
  address. (Cloudflare, like any host, sees the IP of whoever connects to it.)

## What it protects against

| Risk | What the relay and app do |
|---|---|
| Strangers joining | Rooms are private: an unguessable 8-character code is the only way in, and a room holds 2 players. |
| Offensive names | Names are checked in the app and again on the relay: letters, numbers, spaces, `.` `'` `_` `-`, at most 16 characters, plus an English profanity filter (`obscenity`). |
| Abusive messages | There's no chat. Pokémon nicknames are replaced by species names online. |
| Breaking the battle or the page | Every message is size-limited (64 KB), rate-limited (60 per 10 s, else disconnected), and checked against the expected shapes. Names can't contain `\|`, which the battle protocol uses. Nothing received is rendered as HTML. |
| Other websites using your relay | Only pages from `ALLOWED_ORIGINS` can connect (this stops other sites in browsers, not someone writing their own script). |
| A partner going quiet | The host can let the AI play the partner's Pokémon; it takes over automatically if the partner leaves. |

**Not protected:** the host's browser runs the battle, so someone using a modified
copy of the app as host could cheat. Play with people you know.

## Set it up

You need Node.js (already installed for the app) and a free Cloudflare account.

1. **Make a Cloudflare account** at <https://dash.cloudflare.com/sign-up> and verify your email.

2. **Install** (in Terminal, from the project folder):

   ```bash
   npm install
   ```

   ```bash
   cd relay
   npm install
   ```

   The relay reuses the app's name rules (`src/online/`), so the first `npm install` (in the project root) is needed too.

3. **Log in to Cloudflare** (opens your browser; click **Allow**):

   ```bash
   npx wrangler login
   ```

4. **Allow your site.** Open `relay/wrangler.toml` and replace `https://your-site.netlify.app` in
   `ALLOWED_ORIGINS` with your Netlify address (Netlify → your site → the URL under the site name,
   e.g. `https://battle-tree-abc123.netlify.app`). Use `https://`, no slash at the end. Keep
   `http://localhost:5173` if you want to test locally. Add a custom domain too if you have one,
   separated by a comma.

5. **Deploy:**

   ```bash
   npm run deploy
   ```

   The first time, Wrangler may ask you to choose a `workers.dev` subdomain. When it finishes it
   prints the relay's address, like `https://battle-tree-relay.your-name.workers.dev`. Copy it.

6. **Check it:** open that address in a browser. It should say "Battle Tree relay is running."

## Connect the Netlify app

The app reads the relay address (`VITE_RELAY_URL`) when it's **built**, so rebuild after setting it.

**If you build on your computer and drag the `dist` folder to Netlify:**

1. In the project folder (not `relay/`), create a file named `.env.production.local` containing:

   ```
   VITE_RELAY_URL=https://battle-tree-relay.your-name.workers.dev
   ```

   (Git ignores this file.)

2. Build:

   ```bash
   npm run build
   ```

3. In Netlify, open your site → **Deploys** → drag the new `dist` folder onto the drop area.

**If Netlify builds from your Git repository instead:** Netlify → your site → **Site configuration**
→ **Environment variables** → **Add a variable**: key `VITE_RELAY_URL`, value the relay's address.
Then **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.

## Play

1. Each player sets a trainer name in **Settings**.
2. One player opens **Online** → **Make a room** (needs Super Multi unlocked) and sends the code or
   the invite link.
3. The other opens the link (or **Online** → enters the code → **Join**).
4. Both choose 2 Pokémon. The host presses **Start battle**. Keep winning to keep the streak.

## Test on your own computer

Two terminals:

```bash
cd relay
npm run dev
```

Then, in the project folder, create `.env.development.local` with
`VITE_RELAY_URL=http://127.0.0.1:8787` and run the app:

```bash
npm run dev
```

Open <http://localhost:5173/#/online> in two browser windows. Use a private window for the second
one so the two players have different names (settings are shared within one browser).

## Change or remove it

- After editing anything in `relay/` (including `ALLOWED_ORIGINS`), run `npm run deploy` again.
- To turn online play off: remove `VITE_RELAY_URL` and rebuild the app. To delete the relay:
  `npx wrangler delete` (in `relay/`).
- Cloudflare's free plan has daily limits (requests and Durable Object usage). If they're ever
  reached, rooms stop working until the next day; nothing is charged on the free plan.
