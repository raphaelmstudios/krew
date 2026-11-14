// Fills an empty KREW database with demo data, so every page has something real-looking on
// it: 5 organizers (each an events company with a bio), 10 approved crew members with bios,
// skills and different amounts of completed work, 1 crew member waiting for approval, open
// gigs with applicants, jobs waiting for payment confirmation, and a dispute for the admin.
//
// Every person, company and event here is made up for the demo.
//
// Locally every demo account uses the password krewdemo2026.
// On the live site (NODE_ENV=production) the demo accounts would be public, so this only runs
// when the server starts it on an empty database (SEED_DEMO_DATA=true, see src/bootstrap.js),
// and only with a private password you set yourself in DEMO_PASSWORD - never the known one.
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && process.env.KREW_STARTUP_SEED !== '1') {
  console.error('Refusing to run by hand on the live server. Set SEED_DEMO_DATA=true instead - see the README.');
  process.exit(1);
}
if (isProduction && (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 8)) {
  console.error('Refusing to seed: set DEMO_PASSWORD (8+ characters) so the live demo accounts have a private password.');
  process.exit(1);
}

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, '..', 'krew.db'));
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'krewdemo2026';
const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

if (db.prepare(`SELECT COUNT(*) AS count FROM users`).get().count > 0) {
  console.error('The database already has accounts in it. Run reset_demo_data.cjs first, then seed again.');
  process.exit(1);
}

// The server adds these columns when it starts. Added here too, so seeding still works on a
// database the newest server code hasn't opened yet.
for (const column of ['cover_photo_path TEXT', 'company_name TEXT']) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${column};`);
  } catch (err) {
    if (!err.message.includes('duplicate column name')) throw err;
  }
}

// --- Helpers ----------------------------------------------------------------------------
// A fixed-seed random number generator, so every reset produces the same demo data.
let randomState = 20261113;
function random() {
  randomState = (randomState * 1664525 + 1013904223) % 4294967296;
  return randomState / 4294967296;
}
function pick(list) {
  return list[Math.floor(random() * list.length)];
}
function between(min, max, step = 1) {
  return min + Math.floor(random() * ((max - min) / step + 1)) * step;
}

// Dates are stored the way SQLite's datetime('now') writes them: UTC, "YYYY-MM-DD HH:MM:SS".
const DAY = 24 * 60 * 60 * 1000;
function daysFromNow(days, hour = 12) {
  const date = new Date(Date.now() + days * DAY);
  date.setUTCHours(hour, between(0, 59), 0, 0);
  return date;
}
function sqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
function sqlDate(date) {
  return date.toISOString().slice(0, 10);
}

const insertUserStatement = db.prepare(
  `INSERT INTO users (name, phone, password_hash, role, verification_status, company_name, bio,
     professional_role, skills, years_experience, availability_status, created_at)
   VALUES (@name, @phone, @password_hash, @role, @verification_status, @company_name, @bio,
     @professional_role, @skills, @years_experience, @availability_status, @created_at)`
);
function insertUser(user) {
  return insertUserStatement.run({
    verification_status: 'approved',
    company_name: null,
    bio: null,
    professional_role: null,
    skills: null,
    years_experience: null,
    availability_status: 'available',
    created_at: sqlDateTime(daysFromNow(-between(250, 320))),
    password_hash: passwordHash,
    ...user,
    skills: user.skills ? user.skills.join(',') : null,
  }).lastInsertRowid;
}

const insertListing = db.prepare(
  `INSERT INTO job_listings (organizer_id, amount, due_date, job_description, title, category, location, status, created_at)
   VALUES (@organizer_id, @amount, @due_date, @job_description, @title, @category, @location, @status, @created_at)`
);
const insertApplication = db.prepare(
  `INSERT INTO job_applications (listing_id, crew_member_id, status, created_at) VALUES (?, ?, ?, ?)`
);
const insertTransaction = db.prepare(
  `INSERT INTO transactions (organizer_id, crew_member_id, listing_id, amount, due_date, job_description, status,
     organizer_confirmed_at, organizer_confirmed_amount, crew_confirmed_at, crew_confirmed_amount, completed_at, created_at)
   VALUES (@organizer_id, @crew_member_id, @listing_id, @amount, @due_date, @job_description, @status,
     @organizer_confirmed_at, @organizer_confirmed_amount, @crew_confirmed_at, @crew_confirmed_amount, @completed_at, @created_at)`
);

// --- People ---------------------------------------------------------------------------------
insertUser({ name: 'Demo Admin', phone: '0711000001', role: 'admin' });

// Organizers. latePaymentChance shapes their on-time record: Bloomfield always pays on time,
// Kilele is often a few days late. Lakeside Live is brand new, with no record yet.
const ORGANIZERS = [
  {
    key: 'bloomfield',
    name: 'Wanjiru Kamau',
    phone: '0711000002',
    company_name: 'Bloomfield Celebrations',
    bio: "We plan weddings, ruracios and milestone birthdays across Nairobi, from 80-guest garden ceremonies in Karen to 500-guest receptions. Ten years in, we know the day only works when the crew does, so we brief everyone properly, feed everyone, and pay on the day. Always.",
    latePaymentChance: 0,
    events: [
      { name: 'garden wedding', location: 'Karen, Nairobi' },
      { name: 'wedding reception', location: 'Runda, Nairobi' },
      { name: 'engagement party', location: 'Lavington, Nairobi' },
      { name: 'ruracio ceremony', location: 'Kiambu Road, Nairobi' },
    ],
  },
  {
    key: 'lakeside',
    name: 'Otieno Mwangi',
    phone: '0711000003',
    company_name: 'Lakeside Live Sessions',
    bio: "Intimate live music nights for 100 to 300 people: acoustic sets, jazz evenings and up-and-coming Kenyan artists. We're just getting started on KREW and building a regular crew we can call on every month.",
    latePaymentChance: 0,
    events: [{ name: 'acoustic night', location: 'Kilimani, Nairobi' }],
  },
  {
    key: 'mvua',
    name: 'Akinyi Njoroge',
    phone: '0711000007',
    company_name: 'Mvua Festival Co.',
    bio: "Big outdoor music festivals and Afro-house nights for 2,000 to 15,000 people. Our weekends run on dozens of crew at once: stage, sound, bars, security and ushers. Rain or shine (hence the name), the show goes on and the crew gets paid.",
    latePaymentChance: 0.1,
    events: [
      { name: 'weekend music festival', location: 'Ngong Racecourse, Nairobi' },
      { name: 'Afro-house night', location: 'Westlands, Nairobi' },
      { name: 'open-air concert', location: 'Karura, Nairobi' },
      { name: 'album launch', location: 'Industrial Area, Nairobi' },
    ],
  },
  {
    key: 'kilele',
    name: 'Kiprono Langat',
    phone: '0711000008',
    company_name: 'Kilele Corporate Events',
    bio: "Conferences, product launches and end-of-year galas for companies in Nairobi. We care about the details: clean AV, sharp ushers and a stage that looks like a brand, not a hotel ballroom. Payments go through our finance team, so allow a few days at month end.",
    latePaymentChance: 0.35,
    events: [
      { name: 'product launch', location: 'Westlands, Nairobi' },
      { name: 'tech conference', location: 'Upper Hill, Nairobi' },
      { name: 'annual gala dinner', location: 'Gigiri, Nairobi' },
      { name: 'company retreat', location: 'Limuru Road, Nairobi' },
    ],
  },
  {
    key: 'anga',
    name: 'Halima Abdi',
    phone: '0711000009',
    company_name: 'Anga Rooftop Socials',
    bio: "Sundowners, listening parties and brand activations on Nairobi's best rooftops. Small, stylish and fast-moving: we need crew who can set up a bar in an hour, keep the vibe right and pack down by midnight. Regulars get first call on every booking.",
    latePaymentChance: 0.05,
    events: [
      { name: 'rooftop sundowner', location: 'Kilimani, Nairobi' },
      { name: 'brand activation', location: 'Westlands, Nairobi' },
      { name: 'listening party', location: 'CBD, Nairobi' },
      { name: "New Year's Eve party", location: 'Kileleshwa, Nairobi' },
    ],
  },
];

const organizerIds = {};
for (const organizer of ORGANIZERS) {
  organizerIds[organizer.key] = insertUser({
    name: organizer.name,
    phone: organizer.phone,
    role: 'organizer',
    company_name: organizer.company_name,
    bio: organizer.bio,
  });
}

// Crew. confirmedJobs is how many completed, payment-confirmed jobs each one starts with,
// spread out so the directory shows everything from brand new to well established.
const CREW = [
  {
    key: 'achieng',
    name: 'Achieng Odhiambo',
    phone: '0711000004',
    professional_role: 'Event Photographer',
    gigTitle: 'Event photographer',
    category: 'Photography & Videography',
    skills: ['Wedding Photography', 'Candid Portraits', 'Low-light Shooting', 'Lightroom', 'Same-day Edits'],
    years_experience: 6,
    pay: [9000, 15000],
    confirmedJobs: 14,
    bio: "I shoot the moments people miss: the father's face during the first dance, the bartender mid-pour, the crowd the second the bass drops. Six years of weddings, festivals and launches, two cameras on me at all times, and edits in your inbox within 48 hours.",
  },
  {
    key: 'mutiso',
    name: 'Mutiso Kyalo',
    phone: '0711000005',
    professional_role: 'Bartender',
    gigTitle: 'Bartender',
    category: 'Bar Service',
    skills: ['Cocktails', 'Speed Service', 'Cash Handling'],
    years_experience: 1,
    pay: [5000, 7500],
    confirmedJobs: 0,
    bio: "Fresh off a year behind the bar at a busy Westlands lounge and ready for events. I'm quick, I'm friendly, and I can make a mean dawa. New to KREW, so book me and let me prove it.",
  },
  {
    key: 'kevin',
    name: 'Kevin Kiprotich',
    phone: '0711000010',
    professional_role: 'Sound Engineer',
    gigTitle: 'Sound engineer',
    category: 'Sound & AV',
    skills: ['Live Mixing', 'Stage Monitors', 'Wireless Mics', 'System Setup', 'Troubleshooting'],
    years_experience: 9,
    pay: [10000, 18000],
    confirmedJobs: 11,
    availability_status: 'working',
    bio: "Nine years mixing everything from a 50-seat acoustic set to a 10,000-strong festival main stage. If the speech is clear, the drop hits and nobody notices the sound at all, I've done my job. I bring my own in-ear kit and a spare of everything.",
  },
  {
    key: 'juma',
    name: 'Juma Hassan',
    phone: '0711000011',
    professional_role: 'Security Lead',
    gigTitle: 'Security lead',
    category: 'Security',
    skills: ['Crowd Management', 'Access Control', 'VIP Protection', 'First Aid', 'Team Briefing'],
    years_experience: 7,
    pay: [4000, 7000],
    confirmedJobs: 9,
    bio: "Calm, firm and always one step ahead of the crowd. I lead security teams of 4 to 40 for concerts, galas and weddings, and I'm first-aid certified. Good security is the kind guests never think about. That's what I deliver.",
  },
  {
    key: 'faith',
    name: 'Faith Wambui',
    phone: '0711000012',
    professional_role: 'Head Usher',
    gigTitle: 'Head usher',
    category: 'Ushering & Guest Services',
    skills: ['Guest Relations', 'Seating Plans', 'VIP Hosting', 'Registration Desks'],
    years_experience: 4,
    pay: [3000, 5000],
    confirmedJobs: 8,
    bio: "The first smile your guests see. I run registration desks, seating plans and VIP tables, and I can calm a lost auntie and a late CEO in the same minute. Four years of conferences and weddings, and not one guest left without a seat.",
  },
  {
    key: 'grace',
    name: 'Grace Muthoni',
    phone: '0711000013',
    professional_role: 'Mixologist',
    gigTitle: 'Mixologist',
    category: 'Bar Service',
    skills: ['Signature Cocktails', 'Mocktails', 'Bar Setup', 'Flair', 'Stock Control'],
    years_experience: 5,
    pay: [5000, 8500],
    confirmedJobs: 6,
    availability_status: 'working',
    bio: "I design a signature cocktail for every event, from a passion-fruit mojito for a garden wedding to a smoky old fashioned for a gala. Five years behind rooftop and festival bars. Fast service, zero waste, and a bar that looks as good as it pours.",
  },
  {
    key: 'dennis',
    name: 'Dennis Ouma',
    phone: '0711000014',
    professional_role: 'Lighting Technician',
    gigTitle: 'Lighting technician',
    category: 'Sound & AV',
    skills: ['Stage Lighting', 'DMX Programming', 'Uplighting', 'Rigging'],
    years_experience: 3,
    pay: [8000, 14000],
    confirmedJobs: 4,
    bio: "I paint rooms with light. Moody uplighting for a dinner, a full DMX show for a headline set, or simply making sure the speaker's face isn't in shadow. Three years in and still the first one to arrive and the last to leave the rig.",
  },
  {
    key: 'wairimu',
    name: 'Wairimu Ndungu',
    phone: '0711000015',
    professional_role: 'Videographer',
    gigTitle: 'Videographer',
    category: 'Photography & Videography',
    skills: ['Event Films', 'Drone Footage', 'Reels', 'Colour Grading'],
    years_experience: 2,
    pay: [10000, 16000],
    confirmedJobs: 3,
    bio: "Event films that feel like the night did. I shoot handheld and from the air, and cut a 60-second reel by the next morning so your event is on Instagram while people are still talking about it.",
  },
  {
    key: 'collins',
    name: 'Collins Barasa',
    phone: '0711000016',
    professional_role: 'Stage & Setup Crew',
    gigTitle: 'Stage setup crew',
    category: 'Event Setup & Teardown',
    skills: ['Stage Building', 'Tent Setup', 'Load-in', 'Teardown'],
    years_experience: 2,
    pay: [3500, 6000],
    confirmedJobs: 2,
    bio: "Strong hands, early starts and no fuss. I build stages, put up tents and set out 500 chairs before your first guest arrives, then pack it all down when the music stops. Reliable is my whole thing.",
  },
  {
    key: 'esther',
    name: 'Esther Chebet',
    phone: '0711000017',
    professional_role: 'Catering Server',
    gigTitle: 'Catering server',
    category: 'Catering',
    skills: ['Plated Service', 'Buffet Service', 'Food Safety'],
    years_experience: 1,
    pay: [3000, 5000],
    confirmedJobs: 1,
    bio: "Hospitality student with a year of weekend events under my belt. I serve plated dinners and buffets for up to 300 guests, I know my food safety, and I keep a smile on until the last plate is cleared.",
  },
];

const crewIds = {};
for (const crewMember of CREW) {
  crewIds[crewMember.key] = insertUser({
    name: crewMember.name,
    phone: crewMember.phone,
    role: 'crew_member',
    professional_role: crewMember.professional_role,
    skills: crewMember.skills,
    years_experience: crewMember.years_experience,
    availability_status: crewMember.availability_status || 'available',
    bio: crewMember.bio,
  });
}

// Waiting for an admin to approve them (shows in the admin's Approvals).
insertUser({
  name: 'Nafula Wekesa',
  phone: '0711000006',
  role: 'crew_member',
  verification_status: 'pending',
  created_at: sqlDateTime(daysFromNow(-1)),
});

const crewByKey = Object.fromEntries(CREW.map((crewMember) => [crewMember.key, crewMember]));
const organizerByKey = Object.fromEntries(ORGANIZERS.map((organizer) => [organizer.key, organizer]));
const ESTABLISHED_ORGANIZERS = ['bloomfield', 'mvua', 'kilele', 'anga'];

function amountFor(crewMember) {
  return between(crewMember.pay[0], crewMember.pay[1], 500);
}

// --- Completed jobs ------------------------------------------------------------------------
// Each one is a past gig that was filled and paid, with both sides confirming the same
// amount. Most came from an open listing (so the crew member's work history shows the gig's
// title); some were direct hires.
for (const crewMember of CREW) {
  for (let index = 0; index < crewMember.confirmedJobs; index += 1) {
    const organizerKey = ESTABLISHED_ORGANIZERS[(index + crewMember.key.length) % ESTABLISHED_ORGANIZERS.length];
    const organizer = organizerByKey[organizerKey];
    const event = pick(organizer.events);
    const amount = amountFor(crewMember);
    const eventDay = daysFromNow(-between(8, 260), 18);
    const title = `${crewMember.gigTitle}, ${event.name}`;
    const description = `${crewMember.gigTitle} for a ${event.name} by ${organizer.company_name}.`;

    // Payment is due two days after the event. On time means both sides had confirmed it
    // by the start of that day (how the organizer record counts it, see routes/users.js);
    // a late payment lands one to five days after.
    const dueDate = new Date(eventDay.getTime() + 2 * DAY);
    const dueStart = new Date(`${sqlDate(dueDate)}T00:00:00Z`);
    const late = random() < organizer.latePaymentChance;
    const paidAt = late
      ? new Date(dueStart.getTime() + between(1, 5) * DAY + between(1, 10) * 60 * 60 * 1000)
      : new Date(eventDay.getTime() + between(2, 26) * 60 * 60 * 1000);
    const otherSideAt = new Date(paidAt.getTime() - between(1, 20) * 60 * 60 * 1000);
    const organizerFirst = random() < 0.5;

    let listingId = null;
    if (random() < 0.8) {
      listingId = insertListing.run({
        organizer_id: organizerIds[organizerKey],
        amount,
        due_date: sqlDate(dueDate),
        job_description: description,
        title,
        category: crewMember.category,
        location: event.location,
        status: 'filled',
        created_at: sqlDateTime(new Date(eventDay.getTime() - between(7, 21) * DAY)),
      }).lastInsertRowid;
      insertApplication.run(listingId, crewIds[crewMember.key], 'accepted', sqlDateTime(new Date(eventDay.getTime() - between(3, 6) * DAY)));
    }

    insertTransaction.run({
      organizer_id: organizerIds[organizerKey],
      crew_member_id: crewIds[crewMember.key],
      listing_id: listingId,
      amount,
      due_date: sqlDate(dueDate),
      job_description: description,
      status: 'confirmed',
      organizer_confirmed_at: sqlDateTime(organizerFirst ? otherSideAt : paidAt),
      organizer_confirmed_amount: amount,
      crew_confirmed_at: sqlDateTime(organizerFirst ? paidAt : otherSideAt),
      crew_confirmed_amount: amount,
      completed_at: sqlDateTime(paidAt),
      created_at: sqlDateTime(new Date(eventDay.getTime() - between(2, 5) * DAY)),
    });
  }
}

// --- Open gigs on Find Work ------------------------------------------------------------------
const OPEN_GIGS = [
  {
    organizer: 'bloomfield',
    title: 'Two bartenders for a garden wedding',
    category: 'Bar Service',
    location: 'Karen, Nairobi',
    amount: 7000,
    inDays: 9,
    description: "250 guests, cocktail hour from 4pm then a full bar until 11pm. We supply the stock and glassware; you bring speed and a smile. Black shirts, please. Dinner provided.",
    applicants: ['mutiso', 'grace'],
  },
  {
    organizer: 'bloomfield',
    title: 'Ushers for a 400-guest reception',
    category: 'Ushering & Guest Services',
    location: 'Runda, Nairobi',
    amount: 4000,
    inDays: 16,
    description: "Six ushers to run the gate, guest list and seating plan for a large wedding reception. Briefing at 1pm on the day. Experience with seating charts is a plus.",
    applicants: ['faith'],
  },
  {
    organizer: 'lakeside',
    title: 'Sound engineer for an acoustic night',
    category: 'Sound & AV',
    location: 'Kilimani, Nairobi',
    amount: 9000,
    inDays: 12,
    description: "Three acoustic acts, 150 guests, small PA provided. We need someone who can get a warm, clear mix for vocals and guitar and run a quick soundcheck from 5pm.",
    applicants: ['kevin'],
  },
  {
    organizer: 'lakeside',
    title: 'Event photographer, jazz evening',
    category: 'Photography & Videography',
    location: 'Kilimani, Nairobi',
    amount: 8000,
    inDays: 19,
    description: "Candid shots of the band and the crowd for our socials. 7pm to 11pm. 40 edited photos within three days.",
    applicants: [],
  },
  {
    organizer: 'mvua',
    title: 'Security team, weekend music festival',
    category: 'Security',
    location: 'Ngong Racecourse, Nairobi',
    amount: 6000,
    inDays: 22,
    description: "Per person, per day. 30 guards needed across gates, backstage and the VIP area for a two-day festival with 12,000 guests a day. Team briefing on Friday evening.",
    applicants: ['juma'],
  },
  {
    organizer: 'mvua',
    title: 'Stage crew for festival load-in',
    category: 'Event Setup & Teardown',
    location: 'Ngong Racecourse, Nairobi',
    amount: 5500,
    inDays: 20,
    description: "Building the main stage and two side stages over two days before the festival. Heavy lifting, early starts, lunch on site. Safety boots required.",
    applicants: ['collins'],
  },
  {
    organizer: 'mvua',
    title: 'Lighting technician, Afro-house night',
    category: 'Sound & AV',
    location: 'Westlands, Nairobi',
    amount: 12000,
    inDays: 6,
    description: "Run the lighting desk for a 1,500-person club night with three headline DJs. Rig is in place; you programme and operate. DMX experience essential.",
    applicants: ['dennis'],
  },
  {
    organizer: 'kilele',
    title: 'AV technician for a tech conference',
    category: 'Sound & AV',
    location: 'Upper Hill, Nairobi',
    amount: 14000,
    inDays: 14,
    description: "Two-day conference, one main hall and two breakout rooms. Projectors, lapel mics, a livestream feed and a lot of speaker laptops. Smart casual dress code.",
    applicants: [],
  },
  {
    organizer: 'kilele',
    title: 'Registration desk team, gala dinner',
    category: 'Ushering & Guest Services',
    location: 'Gigiri, Nairobi',
    amount: 4500,
    inDays: 27,
    description: "Check in 600 guests using a tablet guest list, hand out table cards and guide VIPs. Formal wear. 5pm to 10pm.",
    applicants: [],
  },
  {
    organizer: 'kilele',
    title: 'Catering servers for a product launch',
    category: 'Catering',
    location: 'Westlands, Nairobi',
    amount: 4000,
    inDays: 8,
    description: "Canapé and drinks service for 300 guests at a car launch. Uniform provided. Food handling certificate preferred.",
    applicants: ['esther'],
  },
  {
    organizer: 'anga',
    title: 'Mixologist for a rooftop sundowner',
    category: 'Bar Service',
    location: 'Kilimani, Nairobi',
    amount: 8000,
    inDays: 4,
    description: "Create and serve two signature cocktails for 120 guests, 5pm to 10pm. Bar, ice and stock provided. Bring your own tools if you have them.",
    applicants: ['grace', 'mutiso'],
  },
  {
    organizer: 'anga',
    title: 'Videographer for a brand activation',
    category: 'Photography & Videography',
    location: 'Westlands, Nairobi',
    amount: 15000,
    inDays: 11,
    description: "Shoot a 60-second recap reel and five short clips for a drinks brand's rooftop launch. Delivered within 24 hours. Drone footage a big plus.",
    applicants: ['wairimu', 'achieng'],
  },
];

for (const gig of OPEN_GIGS) {
  const listingId = insertListing.run({
    organizer_id: organizerIds[gig.organizer],
    amount: gig.amount,
    due_date: sqlDate(daysFromNow(gig.inDays)),
    job_description: gig.description,
    title: gig.title,
    category: gig.category,
    location: gig.location,
    status: 'open',
    created_at: sqlDateTime(daysFromNow(-between(1, 6))),
  }).lastInsertRowid;
  for (const applicant of gig.applicants) {
    insertApplication.run(listingId, crewIds[applicant], 'pending', sqlDateTime(daysFromNow(-between(0, 1))));
  }
}

// --- Jobs in progress: agreed, waiting for both sides to confirm payment ---------------------
function activeJob({ organizer, crew, amount, dueInDays, event, organizerConfirmed = null, crewConfirmed = null }) {
  const organizerDetails = organizerByKey[organizer];
  const crewMember = crewByKey[crew];
  const due = daysFromNow(dueInDays, 18);
  return insertTransaction.run({
    organizer_id: organizerIds[organizer],
    crew_member_id: crewIds[crew],
    listing_id: null,
    amount,
    due_date: sqlDate(due),
    job_description: `${crewMember.gigTitle} for a ${event} by ${organizerDetails.company_name}.`,
    status: 'pending',
    organizer_confirmed_at: organizerConfirmed ? sqlDateTime(daysFromNow(-0.2)) : null,
    organizer_confirmed_amount: organizerConfirmed,
    crew_confirmed_at: crewConfirmed ? sqlDateTime(daysFromNow(-0.3)) : null,
    crew_confirmed_amount: crewConfirmed,
    completed_at: null,
    created_at: sqlDateTime(daysFromNow(-between(4, 9))),
  }).lastInsertRowid;
}

// Coming up, nobody has confirmed yet.
activeJob({ organizer: 'bloomfield', crew: 'achieng', amount: 12000, dueInDays: 3, event: 'engagement party' });
activeJob({ organizer: 'mvua', crew: 'kevin', amount: 16000, dueInDays: 5, event: 'open-air concert' });
// Done, and the crew member has confirmed - the organizer still needs to.
activeJob({ organizer: 'bloomfield', crew: 'grace', amount: 6500, dueInDays: -2, event: 'ruracio ceremony', crewConfirmed: 6500 });
// Done, and the organizer has confirmed - the crew member still needs to.
activeJob({ organizer: 'kilele', crew: 'juma', amount: 5500, dueInDays: -1, event: 'product launch', organizerConfirmed: 5500 });

// --- A dispute for the admin to settle -------------------------------------------------------
const disputedJobId = insertTransaction.run({
  organizer_id: organizerIds.kilele,
  crew_member_id: crewIds.collins,
  listing_id: null,
  amount: 5000,
  due_date: sqlDate(daysFromNow(-3, 18)),
  job_description: 'Stage setup crew for a company retreat by Kilele Corporate Events.',
  status: 'disputed',
  organizer_confirmed_at: sqlDateTime(daysFromNow(-1)),
  organizer_confirmed_amount: 4500,
  crew_confirmed_at: sqlDateTime(daysFromNow(-2)),
  crew_confirmed_amount: 5000,
  completed_at: null,
  created_at: sqlDateTime(daysFromNow(-10)),
}).lastInsertRowid;
db.prepare(
  `INSERT INTO disputes (transaction_id, raised_by, reason, details) VALUES (?, ?, 'Amount mismatch', ?)`
).run(
  disputedJobId,
  crewIds.collins,
  'We agreed KES 5,000 for the full setup and teardown. KES 4,500 was paid. The organizer says the extra 500 was for an hour of teardown that was finished early.'
);

const counts = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS organizers,
       (SELECT COUNT(*) FROM users WHERE role = 'crew_member' AND verification_status = 'approved') AS crew,
       (SELECT COUNT(*) FROM job_listings WHERE status = 'open') AS open_gigs,
       (SELECT COUNT(*) FROM transactions WHERE status = 'confirmed') AS completed_jobs`
  )
  .get();

console.log(`Demo data seeded: ${counts.organizers} organizers, ${counts.crew} approved crew, ${counts.open_gigs} open gigs, ${counts.completed_jobs} completed jobs.
Every account's password is: ${isProduction ? 'the DEMO_PASSWORD you set' : DEMO_PASSWORD}

  Admin:                            0711000001
  Organizer, Bloomfield Celebrations: 0711000002 (Wanjiru Kamau)
  Organizer, Lakeside Live (new):     0711000003 (Otieno Mwangi)
  Organizer, Mvua Festival Co.:       0711000007 (Akinyi Njoroge)
  Organizer, Kilele Corporate Events: 0711000008 (Kiprono Langat)
  Organizer, Anga Rooftop Socials:    0711000009 (Halima Abdi)
  Crew, 14 completed jobs:            0711000004 (Achieng Odhiambo)
  Crew, new:                          0711000005 (Mutiso Kyalo)
  Crew, waiting for approval:         0711000006 (Nafula Wekesa)
  More crew:                          0711000010 to 0711000017
`);
