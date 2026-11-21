# KREW

KREW helps event organizers in Nairobi find crew, and helps crew find paid event work. Every payment is confirmed by both people on the job, so each person builds a record that others can trust before they agree to work together.

KREW keeps track of payments. It does not send, hold or receive money. Organizers pay crew directly, by cash or mobile money, and both sides then confirm the amount on KREW.

## Who uses KREW

**Crew** are bartenders, security staff, ushers, photographers, sound engineers, setup crews and other event workers.

**Organizers** are the people and companies who run events and need crew.

**Admins** are the KREW team. They check new accounts, settle disputes and help people who forget their password.

## Features

### For crew

* Browse open gigs on Find Work, with filters for category, location, date and pay.
* See each organizer's payment record before applying: how many jobs they have paid and had confirmed, and how often they paid on time.
* Apply to gigs and follow each application from your dashboard.
* Build a public profile with a photo, a cover photo, your role, skills, years of experience, a short bio and portfolio photos.
* Every confirmed job appears in your verified work history, which organizers can see.
* Set yourself as available or currently working.

### For organizers

* Post a gig with a title, category, location, pay, due date, description and an optional photo.
* Review applicants, open their profiles and accept the one you want.
* Hire crew directly from Find Crew or from a crew profile, without posting a gig first.
* Confirm what you paid. Your on time payment record builds up from these confirmations.
* Add your company or brand name, a logo and a short bio. Crew see them on every gig you post.

### For admins

* Approve or reject new accounts after checking the uploaded ID and selfie.
* Settle disputes, either by setting the final amount or by reopening the job.
* Help people reset a forgotten password.
* See live numbers for people, gigs, jobs, payments and disputes.

### For everyone

* Light and dark mode.
* Notifications for applications, hires, payments, disputes and account updates.
* Works on phones as well as computers.

## How it works

1. **Sign up.** Choose organizer or crew, then upload a photo of your ID and a selfie.
2. **Get approved.** An admin checks your ID. Until then you can look around but cannot post, apply or hire.
3. **Agree on a job.** An organizer posts a gig and accepts an applicant, or hires someone directly. The job appears in the organizer's Payments and the crew member's My Jobs.
4. **Pay outside KREW.** The organizer pays the crew member directly.
5. **Both sides confirm.** Each person enters the amount that was paid. When the two amounts match, the job is marked complete. It then counts toward the organizer's payment record and the crew member's work history.
6. **If something is wrong,** either person can raise a dispute. An admin looks at both sides and settles it. A disputed job is left out of both records until it is settled.

### Forgotten passwords

KREW has no email or text messages, so a person checks who you are:

1. Choose "Forgot password?" on the log in page and enter your phone number.
2. An admin calls that number and asks a few questions to make sure it is really you.
3. The admin reads you an 8 character code. It works once, for 30 minutes.
4. Enter the code and a new password. Every device that was logged in to your account is logged out.

If you still know your password, use "Change password" in your dashboard.

## What it is built with

* **Website:** React and Vite
* **Server:** Node.js and Express
* **Database:** SQLite (a single file, `server/krew.db`)
* **Uploaded photos and ID documents:** saved in `server/uploads`

## Setting it up on your computer

### What you need

* Node.js version 22 or newer. Check with `node -v`.
* Git.

### 1. Get the code

```bash
git clone https://github.com/raphaelmstudios/krew.git
cd krew
```

### 2. Install everything

```bash
cd server
npm install
cd ../client
npm install
cd ..
```

### 3. Start the server

Open a terminal in the project folder:

```bash
cd server
npm run dev
```

The server runs at http://localhost:4000. It creates the database file the first time it starts.

### 4. Start the website

Open a second terminal in the project folder:

```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser.

### 5. Add demo data (optional)

Start the server at least once first, so the database exists. Then stop it and run:

```bash
cd server
npm run demo
```

This empties the database and loads the demo data, with pictures: company logos, crew profile photos and covers, photos on gigs, and portfolios. The pictures are kept in `server/scripts/seed-assets`, so they come with the code. Run `npm run demo` again at any time to go back to a fresh demo.

Every demo account uses the password `krewdemo2026`. Every person, company and event in the demo data is made up. The crew profile photos are free licence stock images from Pixabay and Pexels, not photos of anyone connected to KREW.

| Phone | Account |
| --- | --- |
| 0711000001 | Admin |
| 0711000002 | Organizer: Bloomfield Celebrations (Wanjiru Kamau), always pays on time |
| 0711000003 | New organizer: Lakeside Live Sessions (Otieno Mwangi) |
| 0711000007 | Organizer: Mvua Festival Co. (Akinyi Njoroge) |
| 0711000008 | Organizer: Kilele Corporate Events (Kiprono Langat), sometimes pays late |
| 0711000009 | Organizer: Anga Rooftop Socials (Halima Abdi) |
| 0711000004 | Crew with 14 completed jobs (Achieng Odhiambo, photographer) |
| 0711000005 | New crew (Mutiso Kyalo, bartender) |
| 0711000006 | Crew waiting for approval (Nafula Wekesa) |
| 0711000010 to 0711000017 | Eight more crew, from 1 to 11 completed jobs |

The demo also has 12 open gigs with applicants, jobs waiting for payment confirmation, and a dispute for the admin to settle.

The admin logs in at http://localhost:5173/admin.

### Start again with an empty database

This deletes every account, job and notification, and the demo pictures. Stop the server first, then run:

```bash
cd server
npm run reset
```

Run `npm run demo` afterwards if you want the demo accounts back.

### Create your own admin account

```bash
cd server
node scripts/create-admin.js "Your Name" "0712345678" "a strong password"
```

### Settings

Settings go in a file called `server/.env`. Copy `server/.env.example` to start. Every setting is optional on your computer. The example file explains each one.

## Deploying

KREW keeps its database and uploaded photos as files on disk. There are two ways to run it online:

* **Render's free plan, with backups.** Free, and no payment card needed. Render wipes the disk whenever the service restarts or is redeployed, so KREW saves everything to free online storage and puts it back when it starts.
* **Fly.io, with a permanent disk.** The simplest and most reliable, but Fly needs a payment card.

Hosts that only run short functions, like Vercel and Netlify, can't run KREW as it is.

### On Render's free plan, with backups

**1. Make a free storage bucket for the backups (Backblaze B2, no card needed).**

1. Sign up for **B2 Cloud Storage** at [backblaze.com](https://www.backblaze.com).
2. Go to **Buckets**, choose **Create a Bucket**, give it a unique name (for example `krew-backups-yourname`) and keep it **Private**.
3. On the new bucket, note the **Endpoint**, for example `s3.us-west-004.backblazeb2.com`. The middle part (`us-west-004`) is your region.
4. Open the bucket's **Lifecycle Settings** and choose **Keep only the last version of the file**, so old copies don't pile up.
5. Go to **Application Keys**, choose **Add a New Application Key**, allow it access to **only that bucket**, with **Read and Write**. Copy the **keyID** and **applicationKey** straight away, because the key is only shown once.

**2. Create the service on Render.**

1. Push the code to GitHub.
2. In Render, choose **New**, then **Blueprint**, and pick this repository. It reads `render.yaml`.
3. Render asks for these values:
   * `ADMIN_NAME`, `ADMIN_PHONE` and `ADMIN_PASSWORD`: your own admin account.
   * `SEED_DEMO_DATA`: `false` for a real pilot, `true` for a demo site. With `true`, the demo data is loaded the first time, and every later start gives the demo accounts any new pictures from `server/scripts/demo_pictures.cjs`, without touching photos uploaded in the app.
   * `DEMO_PASSWORD`: only for a demo site, the password for every demo account. Use something private, not `krewdemo2026`.
   * `BACKUP_S3_ENDPOINT`: the bucket endpoint with `https://` in front, for example `https://s3.us-west-004.backblazeb2.com`.
   * `BACKUP_S3_REGION`: the region, for example `us-west-004`.
   * `BACKUP_S3_BUCKET`: the bucket name.
   * `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY`: the keyID and applicationKey.
   * `BACKUP_ENCRYPTION_KEY`: a long private passphrase that you make up (16 characters or more). **Keep a copy somewhere safe.** Every backup is scrambled with it before it leaves the server, and without it the backups can't be restored.
4. When it's running, open `https://your-app.onrender.com/api/health`. It should show `"backups":{"on":true,...}` with the time of the last backup.

**3. Keep it awake.** Render's free plan puts the service to sleep after 15 minutes without visitors. A free scheduler can visit it every 10 minutes:

1. Sign up at [`cron-job.org`](https://cron-job.org).
2. Create a cron job for `https://your-app.onrender.com/api/health`, every 10 minutes.

One service running all month fits inside Render's 750 free hours.

**How the backups work.** Every 15 minutes KREW checks for changes and, if anything changed, saves the database and uploaded photos to the bucket. When Render stops the service for a restart or redeploy, KREW saves once more before stopping. When it starts on an empty disk, it downloads the latest backup and puts everything back before opening. Seven daily copies are kept as well. If a backup exists but can't be restored (the storage service is down, or the passphrase is wrong), KREW refuses to start rather than starting empty, and Render tries again.

**Your own domain.** In Render, open the service's **Settings**, then **Custom Domains**, and add your domain. If the domain's DNS is on Cloudflare, add the record Render shows as **DNS only** (grey cloud), so Render can set up HTTPS.

### On Fly.io

Fly.io runs KREW on one small machine that never sleeps, with a 1 GB volume that keeps the database and photos. The settings are in `fly.toml` and `Dockerfile` in this folder. At this size it usually costs a few dollars a month, and Fly doesn't charge invoices under $5, but check the estimate in your Fly dashboard after the first few days.

1. Create an account at [fly.io](https://fly.io). Fly may ask for a payment card.
2. Install the Fly command line tool. In WSL or on Mac or Linux:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
   In Windows PowerShell:
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```
3. Log in:
   ```bash
   fly auth login
   ```
4. Open `fly.toml` and check the app name on the line `app = "krew"`. It becomes your address (`krew.fly.dev`) and must be unique on Fly, so change it if it's taken. Then, in the project folder, create the app with the same name:
   ```bash
   fly apps create krew
   ```
5. Create the volume that keeps your data, in Johannesburg (the closest region to Nairobi):
   ```bash
   fly volumes create krew_data --region jnb --size 1
   ```
6. Set your admin account. These are kept private by Fly and never stored in Git:
   ```bash
   fly secrets set ADMIN_NAME="Your Name" ADMIN_PHONE="0712345678" ADMIN_PASSWORD="a strong password"
   ```
7. Deploy:
   ```bash
   fly deploy --ha=false
   ```
8. Check that exactly one machine is running:
   ```bash
   fly status
   ```
   KREW must run on **one machine only**. Each machine gets its own volume, so a second machine would have its own empty database. If you see two, run `fly scale count 1`.
9. Open the site:
   ```bash
   fly open
   ```

**Updating the live site.** After you change the code, run `fly deploy --ha=false` again. The database and photos on the volume are kept.

**Your own domain.** To use a domain you own (for example a `.tech` domain), run `fly certs add yourdomain.tech`. Fly shows the DNS records to add where the domain is registered, then sets up HTTPS by itself.

**Demo data or an empty start.** The live site starts with an empty database, which is right for a real pilot: real people should never see made up organizers or jobs. For a demo site instead, set `SEED_DEMO_DATA = "true"` in `fly.toml` and add a private demo password with `fly secrets set DEMO_PASSWORD="something private"` before the first deploy. Demo data is only loaded into an empty database.

**Backups.** To make a copy of the database and download it to your computer:
```bash
fly ssh console -C "node /app/server/scripts/backup_database.cjs"
fly ssh sftp get /data/krew-backup.db krew-backup.db
```

## Security

* Passwords are stored only as bcrypt hashes.
* Logins use a private cookie that page scripts cannot read. It expires after 7 days.
* Failed logins and password reset codes are limited, to stop guessing.
* ID documents and selfies can only be opened by a logged in admin. They are never public.
* Every uploaded file is checked to make sure it really is a JPG, PNG or PDF.
* Requests that change data are only accepted from KREW's own pages.
* On the live site, HTTPS is required and the usual browser security headers are sent.

## Project layout

```
client/            The website (React)
  public/          Images, icons and other files served as they are
  src/pages/       One file per page
  src/components/  Pieces shared between pages
  src/styles/      Styles
server/            The server (Express)
  src/routes/      The API, grouped by area
  src/db.js        Database tables
  src/security.js  Security checks shared by the whole server
  src/backup.js    Off-site backups (with backupStore.js and restore.js)
  scripts/         Demo data (with its pictures in seed-assets), reset, admin account and backup scripts
render.yaml        Settings for deploying to Render
fly.toml           Settings for deploying to Fly.io
Dockerfile         How Fly.io builds KREW
```

## Not built yet

* Mobile money integration. Payments are confirmed by both people today. A later version could check payments with Safaricom's Daraja API.
* Email or text message notifications. Notifications appear inside KREW only.
