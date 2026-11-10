# Hosting your own copy

## Firebase

Firebase's free Spark plan hosts the page and runs online play for a group of friends. Nobody
needs an account: each browser signs in anonymously, and players pick a name in the game.

This copy is already set up for the Shellfall project (`shellfall-2a422`): its web config is in
`FIREBASE_CONFIG` near the top of the script in `index.html`, and `.firebaserc` names the project.
To redeploy it, skip to step 5. To run your own copy on your own Firebase project, follow all the
steps and replace both.

1. **Create the project.** At https://console.firebase.google.com choose **Add project**
   (Analytics can be off).
2. **Realtime Database.** **Build > Realtime Database > Create database**, pick a location,
   start in **locked mode**. The rules in `database.rules.json` replace the locked ones when you
   deploy.
3. **Anonymous sign-in.** **Build > Authentication > Get started > Sign-in method > Anonymous >
   Enable**.
4. **Web config.** **Project settings (gear) > Your apps > Web (`</>`)**, register an app (no
   Firebase Hosting checkbox needed), then copy the `firebaseConfig` values into `index.html`:
   search for `const FIREBASE_CONFIG =` near the top of the script and replace the object with
   yours. It must include `databaseURL` (it appears once the Realtime Database exists).
   These values are not secret; the database rules protect the data.
5. **Deploy** the page and the rules from this folder (needs Node.js; `.firebaserc` names the
   project, so change it if yours is not `shellfall-2a422`):

   ```bash
   npx firebase-tools login
   ```

   ```bash
   npx firebase-tools deploy --only hosting,database
   ```

   The game is then at `https://<project-id>.web.app`. Invite links and QR codes point there.

You can also keep serving `index.html` from GitHub Pages or anywhere else: online play works
from any address once `FIREBASE_CONFIG` is set. Deploy the rules with
`npx firebase deploy --only database`. If sign-in fails there, add that site's domain under
**Authentication > Settings > Authorized domains**.

How it maps: `rooms/{room}/{uid_tab}` holds each open tab's live-game presence and is removed
when the tab closes. A day game's card lives in `cards/{code}`, its moves, checkpoint, shop orders
and leases in `moves/`, `state/`, `kits/` and `lock/` under the code, and `mine/{uid}` indexes
each player's games. Each document is stored as JSON text, so nothing about the game code
changes. The Firebase SDK (13.1.0, compat build) loads from jsdelivr only when online play starts.
An anonymous account lives in that browser's storage: clearing site data, or switching browser
or device, makes you a new player. Your seat in an unfinished day game then waits for someone who
can't come back, so keep playing a day game from the same browser (the host can end it if needed).

The rules (`database.rules.json`): everything needs a sign-in; you can only write your own
presence, your own shop order and your own moves; moves can't be rewritten once stored; only
players of a game can write its moves and checkpoint; a game card can be changed by its
players, or by someone adding themselves to it (joining).

Controls: drag on the field to aim, `A`/`D` to drive, `Q`/`E` to change shells, `Space` to fire
(again mid-air to split), `R` to undo driving, `F` to fast-forward other crews' turns,
`T` for thermal vision, `P` for photo mode, `Esc` to pause.

## Custom domain

To serve the game from your own domain (for example `shellfall.example.com`): Firebase console >
**Hosting** > **Add custom domain**, then add the DNS records it shows at your domain registrar.
HTTPS is set up for you, and invite links follow whatever address the page is opened from.

## Free plan limits

The Spark plan never bills you; if a limit is reached that service pauses until the next month.

- Hosting: about 360 MB of downloads a day (the page is ~400 KB).
- Realtime Database: 100 simultaneous connections, 1 GB stored, 10 GB downloaded a month. Only
  online play connects; solo visitors don't count.
- A day game stores a 50-80 KB checkpoint plus ~0.4 KB per move. Delete finished games from the
  day game manager to keep storage down.

## On claude.ai

The same file also runs as a claude.ai Artifact. There it uses the Artifact platform's `room`,
`db` and `user` capabilities instead of Firebase (declared at publish, together with `downloads`
for photo mode), and `FIREBASE_CONFIG` is ignored. Friends need more than view-only access to the
Artifact to play day games.

## Why the Firebase key is in the code

`FIREBASE_CONFIG` includes an `apiKey`, and GitHub's secret scanning flags it as a leaked Google
API key. It isn't a secret: a Firebase web key only identifies the project, it has to be in the
page for the game to work, and Firebase documents it as safe to publish. What protects the data is
`database.rules.json`. For extra safety, restrict the key in the Google Cloud console
(**APIs & Services > Credentials**, the "Browser key (auto created by Firebase)"): allow only your
game's websites, and only the **Identity Toolkit API** and **Token Service API**. Close the GitHub
alert as **Won't fix**.
