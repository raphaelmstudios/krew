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
* Build a public profile with a photo, your role, skills, years of experience, a short bio and portfolio photos.
* Every confirmed job appears in your verified work history, which organizers can see.
* Set yourself as available or currently working.

### For organizers

* Post a gig with a title, category, location, pay, due date, description and an optional photo.
* Review applicants, open their profiles and accept the one you want.
* Hire crew directly from Find Crew or from a crew profile, without posting a gig first.
* Confirm what you paid. Your on time payment record builds up from these confirmations.

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

With the server running at least once, so the database exists:

```bash
cd server
node scripts/seed_demo_data.cjs
```

Every demo account uses the password `krewdemo2026`:

| Phone | Account |
| --- | --- |
| 0711000001 | Admin |
| 0711000002 | Organizer with a payment record (Wanjiru Kamau) |
| 0711000003 | New organizer (Otieno Mwangi) |
| 0711000004 | Crew with completed jobs (Achieng Odhiambo) |
| 0711000005 | New crew (Mutiso Kyalo) |
| 0711000006 | Crew waiting for approval (Nafula Wekesa) |

The admin logs in at http://localhost:5173/admin.

### Start again with an empty database

This deletes every account, job and notification. Stop the server first, then run:

```bash
cd server
node scripts/reset_demo_data.cjs --yes-really-reset
```

Run the demo data script again afterwards if you want the demo accounts back.

### Create your own admin account

```bash
cd server
node scripts/create-admin.js "Your Name" "0712345678" "a strong password"
```

### Settings

Settings go in a file called `server/.env`. Copy `server/.env.example` to start. Every setting is optional on your computer. The example file explains each one.

## Deploying

The project is set up for [Render](https://render.com) with the `render.yaml` file in this folder.

1. Push the code to GitHub.
2. In Render, choose **New**, then **Blueprint**, and pick this repository.
3. Render asks for four private values:
   * `DEMO_PASSWORD`: the password for every demo account on the live site. Use something private, not `krewdemo2026`.
   * `ADMIN_NAME`, `ADMIN_PHONE` and `ADMIN_PASSWORD`: your own admin account.
4. Render builds the website and starts the server. The first visit after it starts can take about a minute.

**Important about the free plan.** Render's free plan deletes the database and all uploaded photos whenever the service restarts, is redeployed, or goes to sleep after 15 minutes without visitors. To make demos still work, the server reloads the demo data every time it starts with an empty database, and creates your admin account again. This is fine for showing KREW to people. It is not fine for a real pilot, because anything people add is lost.

**For a real pilot,** use a paid Render plan with a persistent disk mounted at `/var/data`, and set:

```
DATABASE_PATH=/var/data/krew.db
UPLOADS_DIR=/var/data/uploads
SEED_DEMO_DATA=false
```

Then the data stays when the service restarts or is redeployed.

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
  scripts/         Demo data, reset and admin account scripts
render.yaml        Settings for deploying to Render
```

## Not built yet

* Mobile money integration. Payments are confirmed by both people today. A later version could check payments with Safaricom's Daraja API.
* Email or text message notifications. Notifications appear inside KREW only.
