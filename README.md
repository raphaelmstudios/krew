# KREW

**Event Crew Payment Verification System.** KREW helps Nairobi's event crew check whether an organizer pays on time before they take a job, and helps organizers see a crew member's verified work before they hire. Every payment is confirmed by both people on the job, so the records can be trusted.

| | |
| --- | --- |
| **Live site** | https://krew-hysf.onrender.com |
| **Demo video** | https://youtu.be/rTI2ad1bCrU |
| **SRS and system design** | [SRS document (Google Docs)](https://docs.google.com/document/d/1hRzuTSFWmo12YcDorseJf1EQ8TPE245hszdPpYBKiqQ/edit?usp=sharing) |
| **Demo logins** | See [Trying KREW](#trying-krew). The password for the live site is in the submission document. |

KREW keeps track of payments. It does not send, hold or receive money. Organizers pay crew directly, by cash or mobile money, and both sides then confirm the amount on KREW.

## Contents

1. [The problem](#the-problem)
2. [The solution](#the-solution)
3. [Who uses KREW](#who-uses-krew)
4. [How it works](#how-it-works)
5. [How KREW meets the SRS](#how-krew-meets-the-srs)
6. [Trying KREW](#trying-krew)
7. [Running KREW on your computer](#running-krew-on-your-computer)
8. [Putting KREW online](#putting-krew-online)
9. [Security and privacy](#security-and-privacy)
10. [Known limitations](#known-limitations)
11. [How it was built](#how-it-was-built)
12. [Project layout](#project-layout)

## The problem

Stage crew, technicians, ushers, bartenders and other event workers in Nairobi are hired informally, through word of mouth, with no contract and no record of who pays. In a survey of 7 event workers for this project, 6 had been paid late or not at all at least once in the past year, and at least 2 had lost over KES 20,000.

Organizers already have ways to check workers before hiring them. Workers have no way to check an organizer before accepting a job. Existing platforms such as PigiaMe, Lynk and WorkKE list jobs or rate workers, but none shows whether the person hiring actually pays.

## The solution

KREW keeps one log of every job and payment, confirmed by both people. Two records are worked out from that log and shown to the other side before a job is agreed:

* **The organizer's payment record:** what share of jobs they paid on or before the due date, how early or late they usually pay, and how often they paid less than agreed.
* **The crew member's verified work:** how many jobs they completed and were paid for.

Nobody types these numbers in and nobody can edit them. There are no star ratings or reviews, only confirmed payments. People with no history yet are shown as "New here" instead of zero, so being new is never read as being bad.

## Who uses KREW

**Crew** are bartenders, security staff, ushers, photographers, sound engineers, setup crews and other event workers.

**Organizers** are the people and companies who run events and need crew.

**Admins** are the KREW team. They check new accounts, settle disputes, help people who forget their password, and handle requests to delete an account.

### What each person can do

**Crew**

* Browse open gigs on Find Work, filtered by category, location, date and pay.
* See each organizer's payment record before applying.
* Apply to gigs and follow each application from the dashboard.
* Build a public profile with a photo, cover photo, role, skills, experience, bio and portfolio.
* Confirm what they were paid, and raise a dispute when something is wrong.
* Set themselves as available or currently working.

**Organizers**

* Post a gig with a title, category, location, pay, due date, description and photo.
* Review applicants, with each one's verified work, and accept one.
* Hire crew directly from Hire Crew without posting a gig.
* Confirm what they paid, and raise a dispute when something is wrong.
* Add a company name, logo and bio that crew see on every gig.

**Admins**

* Approve or reject new accounts after checking the ID and selfie.
* Settle disputes by setting a final amount or reopening the job.
* Help people reset a forgotten password.
* Handle requests to delete an account.
* Read the change log: every change to jobs, payments, disputes and accounts, with who made it and when.
* See live numbers for people, gigs, jobs, payments and disputes.

**Everyone**

* Download a copy of their data, or ask for their account to be deleted, from **Your data** in the dashboard menu.
* Notifications for applications, hires, payments, disputes and account updates.
* Light and dark mode, on phones and computers.

## How it works

1. **Sign up.** Choose organizer or crew, then upload a photo of a government ID and a selfie.
2. **Get approved.** An admin checks the ID. Until then you can look around but can't post, apply or hire.
3. **Agree on a job.** An organizer posts a gig and accepts an applicant, or hires someone directly. This creates the job agreement: amount, due date and description.
4. **Pay outside KREW.** The organizer pays the crew member directly.
5. **Both sides confirm.** Each person enters the amount that was paid. When the two amounts match, the job is complete and counts toward both records. If they don't match, the job stays open and both are told.
6. **If something is wrong,** either person can raise a dispute. The job shows as disputed for both, and is left out of both records until an admin settles it.

The organizer gets a reminder in KREW when a payment is due within 24 hours.

**Forgotten passwords.** KREW has no email or text messages, so a person checks who you are. Choose "Forgot password?" on the log in page and enter your phone number. An admin calls that number, checks it's really you, and reads you a one time code that works for 30 minutes. If you still know your password, use "Change password" in the dashboard menu.

## How KREW meets the SRS

The SRS (Software Requirements Specification) lists what KREW must do. This is where each requirement can be seen in the app.

| SRS | Requirement | Status | Where to see it |
| --- | --- | --- | --- |
| FR 1.1 | Register as crew or organizer with name and phone | Built | Register page |
| FR 1.2 | Upload an ID and a selfie when registering | Built | Second step of registering |
| FR 1.3 | New accounts go to an admin for approval | Built | Admin, Approvals |
| FR 2.1 | Organizer sets up the job agreement before work starts | Built | Post a gig and accept an applicant, or hire directly |
| FR 2.2 | Both sides confirm the payment; it only counts when both match | Built | Organizer Payments, crew My Jobs |
| FR 2.3 | Automatic confirmation through Safaricom's Daraja API | Not built | See [Known limitations](#known-limitations) |
| FR 3.1 | Organizer's on time payment rate | Built | Payment record on every gig and organizer dashboard |
| FR 3.2 | Usual days to payment, and how often they paid less than agreed | Built | Payment record |
| FR 3.3 | Crew see the payment record before accepting a job | Built | Find Work, gig page, direct hire offers |
| FR 4.1, 4.2 | Crew's verified completed jobs, shown to organizers before hiring | Built | Hire Crew, crew profiles, applicant lists |
| FR 5.1, 5.2 | "New here" instead of zero; new people listed equally | Built | Crew cards and organizer records |
| FR 6.1, 6.2 | Either side can dispute a job; it shows as disputed, never deleted | Built | Raise a dispute on any job |
| FR 6.3 | Admin is told about every dispute | Built | Admin notifications and Disputes |
| FR 7.1 | Payment due reminder to the organizer | Partly built | In KREW only, no text messages |
| FR 7.2, 7.3 | Both sides told when a payment is confirmed or disputed | Built | Notification bell |
| NFR 3, BR 1 | Never "paid" on one side's word alone | Built | A job stays open until both amounts match |
| NFR 4 | Confirmed records are never edited; disputes are added beside them | Built | Disputes are separate records linked to the job |
| NFR 5 | Data encrypted in transit and at rest | Partly built | HTTPS on the live site and encrypted backups; the live database file itself is not encrypted |
| NFR 6 | Kenya's Data Protection Act: consent, a copy of your data, deletion | Built | Register page, Privacy Policy, Your data, Admin Data requests |
| NFR 9 | Every change recorded with who and when | Built | Admin, Change log |
| NFR 11 | Works in phone browsers, no install | Built | Open the live site on a phone |
| BR 2, BR 3 | "New here" never filtered out; disputed jobs left out of both records | Built | Hire Crew, payment records |

The use case, class, sequence and state diagrams in the SRS match the app: three roles (crew, organizer, admin), one transaction log, and jobs that move from pending to confirmed, disputed and resolved.

Find Work and Hire Crew go beyond the SRS, which kept job search out of scope. They were added so new people can find each other on KREW, not only through people they already know.

## Trying KREW

### On the live site

Open https://krew-hysf.onrender.com. It runs the demo data below. Every demo account shares one password, which is in the submission document rather than here, because this page is public.

If the site has been idle it can take up to a minute to wake up the first time.

### Demo accounts

Every person, company and event in the demo data is made up. Crew profile photos are free licence stock images from Pixabay and Pexels, not photos of anyone connected to KREW.

| Phone | Account |
| --- | --- |
| 0711000001 | Admin (log in at `/admin`) |
| 0711000002 | Organizer: Bloomfield Celebrations, always pays on time |
| 0711000003 | Organizer: Lakeside Live Sessions, new, no record yet |
| 0711000007 | Organizer: Mvua Festival Co. |
| 0711000008 | Organizer: Kilele Corporate Events, often late and sometimes pays less than agreed |
| 0711000009 | Organizer: Anga Rooftop Socials |
| 0711000004 | Crew: Achieng Odhiambo, photographer, 14 completed jobs |
| 0711000005 | Crew: Mutiso Kyalo, bartender, new in a fresh demo (on the live site he has completed his first job) |
| 0711000006 | Crew: Nafula Wekesa, waiting for approval |
| 0711000010 to 0711000017 | Eight more crew, from 1 to 11 completed jobs |

The demo also has 12 open gigs with applicants, jobs waiting for payment confirmation, and a dispute for the admin to settle.

### A full walk through in about 10 minutes

1. Log in as **Kilele (0711000008)**. The dashboard shows its payment record: often late, and paid less than agreed on some jobs.
2. Log out and log in as **Mutiso (0711000005)**. Open **Find Work**, pick a gig, read the organizer's payment record on the **Organizer** tab, and apply.
3. Log in as the organizer who posted that gig. Open the gig, look at Mutiso's "New here" badge, and accept him.
4. As the organizer, open **Payments** and confirm the amount paid. Then log in as Mutiso, open **My Jobs** and confirm the same amount. The job is now complete and counts on both records.
5. On another job, raise a dispute from either side.
6. Log in as the **admin (0711000001)** at `/admin`. Settle the dispute, approve Nafula's account after viewing her ID, and open the **Change log** to see every step you just took.
7. From any dashboard menu, open **Your data** to download a copy of that account's data.

## Running KREW on your computer

These steps work on Windows, Mac and Linux. On Windows you can use PowerShell, Command Prompt or WSL.

### What you need

* **Node.js 22** (the LTS version). Download it from https://nodejs.org. Check it with `node -v`.
* **Git**, from https://git-scm.com. Check it with `git --version`.

No database server is needed. KREW uses SQLite, which is a single file that is created for you.

### 1. Get the code

```bash
git clone https://github.com/raphaelmstudios/krew.git
cd krew
```

### 2. Install the server and the website

```bash
cd server
npm install
cd ../client
npm install
cd ..
```

This takes a minute or two and needs an internet connection.

Two server packages, `better-sqlite3` and `bcrypt`, contain native code. They come ready made for Windows, Mac and Linux, but npm still checks that your computer could build them. If `npm install` in `server` stops with a `gyp` error, install the build tools and run `npm install` again:

* **Windows:** run the Node.js installer again and tick **Automatically install the necessary tools**. You can also use WSL instead.
* **Mac:** run `xcode-select --install`.
* **Linux or WSL:** run `sudo apt install build-essential python3`.

### 3. Start the server

In a terminal, from the `krew` folder:

```bash
cd server
npm run dev
```

You should see `KREW API listening on http://localhost:4000`. The database file (`server/krew.db`) and the uploads folder are created the first time it starts. Leave this terminal open.

### 4. Start the website

Open a second terminal, from the `krew` folder:

```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser. Leave this terminal open too.

### 5. Load the demo data

Stop the server (press `Ctrl+C` in its terminal), then:

```bash
cd server
npm run demo
npm run dev
```

`npm run demo` empties the database and loads the demo accounts, gigs, jobs and pictures. On your computer every demo account uses the password `krewdemo2026`. The admin logs in at http://localhost:5173/admin.

Run `npm run demo` again at any time to go back to a fresh demo.

### Other things you can do

**Start with an empty database instead.** Stop the server, then run `npm run reset` in the `server` folder. This deletes every account, job and demo picture.

**Create your own admin account.** In the `server` folder:

```bash
node scripts/create-admin.js "Your Name" "0712345678" "a strong password"
```

**Run it as one app, the way the live site does.** Build the website once, then start the server on its own:

```bash
cd client
npm run build
cd ../server
npm start
```

Open http://localhost:4000.

**Settings.** None are needed on your computer. To change one, copy `server/.env.example` to `server/.env` and edit it. The example file explains each setting.

## Putting KREW online

KREW keeps its database and uploaded photos as files on disk, so it needs a host that runs a normal Node.js server. Hosts that only run short functions, like Vercel and Netlify, can't run it as it is.

The live site runs on **Render's free plan**. That plan wipes the disk on every restart, so KREW saves its database and photos to free online storage (Backblaze B2) and puts them back when it starts.

### 1. Make a storage bucket for backups

1. Sign up for **B2 Cloud Storage** at https://www.backblaze.com. No payment card is needed.
2. Go to **Buckets**, choose **Create a Bucket**, give it a unique name (for example `krew-backups-yourname`) and keep it **Private**.
3. Note the bucket's **Endpoint**, for example `s3.us-west-004.backblazeb2.com`. The middle part (`us-west-004`) is the region.
4. In the bucket's **Lifecycle Settings**, choose **Keep only the last version of the file**.
5. Go to **Application Keys** and add a key with **Read and Write** access to that bucket only. Copy the **keyID** and **applicationKey** straight away, because the key is only shown once.

### 2. Create the service on Render

1. In Render, choose **New**, then **Blueprint**, and pick this repository. Render reads `render.yaml`.
2. Fill in the values Render asks for:

| Setting | What to put |
| --- | --- |
| `ADMIN_NAME`, `ADMIN_PHONE`, `ADMIN_PASSWORD` | Your own admin account |
| `SEED_DEMO_DATA` | `true` for a demo site, `false` for a real pilot |
| `DEMO_PASSWORD` | Demo sites only: a private password for every demo account (not `krewdemo2026`) |
| `BACKUP_S3_ENDPOINT` | The endpoint with `https://` in front |
| `BACKUP_S3_REGION` | The region, for example `us-west-004` |
| `BACKUP_S3_BUCKET` | The bucket name |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | The keyID and applicationKey |
| `BACKUP_ENCRYPTION_KEY` | A long private passphrase you make up, 16 characters or more. Keep a copy somewhere safe: backups can't be restored without it. |

3. When it's running, open `https://your-app.onrender.com/api/health`. It should show `"backups":{"on":true,...}`.

### 3. Keep it awake

Render's free plan sleeps after 15 minutes without visitors. Create a free job at https://cron-job.org that opens `https://your-app.onrender.com/api/health` every 10 minutes. One service running all month fits inside Render's 750 free hours.

### How the backups work

Every 15 minutes KREW checks for changes and, if anything changed, saves the database and photos to the bucket, encrypted before they leave the server. It saves once more whenever Render stops it. When it starts on an empty disk, it downloads the latest backup and puts everything back before opening. Seven daily copies are kept too. If a backup exists but can't be restored, KREW refuses to start rather than starting empty, and Render tries again.

### Another option: Fly.io

`fly.toml` and `Dockerfile` run KREW on Fly.io with a permanent 1 GB disk, so no backups are needed. Fly asks for a payment card. Create the app and its volume (`fly volumes create krew_data --region jnb --size 1`), set the admin details with `fly secrets set`, then run `fly deploy --ha=false`. Keep it to one machine, because each machine has its own disk.

## Security and privacy

* Passwords are stored only as bcrypt hashes.
* Logins use a private cookie that page scripts can't read. It expires after 7 days.
* Failed logins and password reset codes are limited, to stop guessing.
* ID photos and selfies can only be opened by a logged in admin and are never public.
* Every uploaded file is checked to make sure it really is an image or PDF.
* Requests that change data are only accepted from KREW's own pages.
* The live site requires HTTPS and sends the usual browser security headers.
* Backups are encrypted with AES 256 before they leave the server.
* People agree to the Terms and Privacy Policy when they register, can download their data at any time, and can ask for their account to be deleted, as Kenya's Data Protection Act requires.
* Every change to jobs, payments, disputes and accounts is kept in a change log that is never edited.

## Known limitations

* **No automatic mobile money check (FR 2.3).** Payments are confirmed by both people instead. The SRS (section 2.5) names this as the fallback if the Daraja integration couldn't be finished in the build period. A placeholder route and a database field are ready for it.
* **No text messages (FR 7.1).** Reminders and notifications appear inside KREW only. Text messages need a paid service such as Africa's Talking.
* **The live database file is not encrypted (NFR 5).** Data is protected by HTTPS in transit and the backups are encrypted, but the database file on the server is not.
* **No uptime guarantee (NFR 8).** Render's free plan has none. The keep alive job and backups are the best the free plan allows.
* **Not load tested (NFR 2).** KREW hasn't been tested with 200 people at once.
* **English only.** Swahili was planned as a later addition in the SRS.

## How it was built

KREW was built with Agile Scrum in sprints, following the SRS sprint plan: the transaction log first, then both reliability records, then onboarding, "New here" and disputes, then a pilot and redesign.

Each task was built on its own branch (for example `feature/d2-2-payment-confirmation`) and merged into `main` through a pull request. The pull requests list what each one added and which SRS requirement it covers.

**Built with:** React 19 and Vite for the website, Node.js 22 and Express 5 for the server, SQLite (`better-sqlite3`) for the database, and `lucide-react` for icons.

## Project layout

```
client/                   The website (React)
  public/                 Images and icons served as they are
  src/pages/              One file per page
  src/components/         Pieces shared between pages
  src/styles/             Styles
server/                   The server (Express)
  src/index.js            Starts the server and serves the website
  src/start.js            Restores a backup if needed, then starts the server
  src/db.js               Database tables
  src/routes/             The API, grouped by area (auth, users, listings, jobs, admin)
  src/audit.js            The change log
  src/security.js         Security checks shared by the whole server
  src/backup.js           Off site backups (with backupStore.js and restore.js)
  src/reminders.js        Payment due reminders
  scripts/                Demo data and its pictures, reset, admin account and backup scripts
render.yaml               Settings for Render
fly.toml, Dockerfile      Settings for Fly.io
```
