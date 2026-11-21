// The pictures each demo account has, by phone number. Paths are inside scripts/seed-assets/.
//
// Used in two places:
// - seed_demo_data.cjs, when it fills an empty database;
// - src/demoPictures.js, every time the live server starts with SEED_DEMO_DATA=true. It gives
//   demo accounts any picture listed here that they don't have yet, so new demo pictures reach
//   a site whose data came back from a backup (and so was never seeded again). It never
//   replaces a picture someone uploaded in the app.
//
// The organizer logos in logos/ are original designs made for the demo. Everything in
// organizers/ and crew/ is a free licence stock image from Pixabay or Pexels, not a photo of
// anyone connected to KREW. Achieng, Mutiso and Esther have no profile photo on purpose, so
// cards with initials show too.

const crew = (key, extra = {}) => ({
  profile: `crew/${key}-profile.jpg`,
  cover: `crew/${key}-cover.jpg`,
  ...extra,
});
const portfolio = (...names) => names.map((name) => `portfolio/${name}.jpg`);

const DEMO_PICTURES = {
  // Organizers
  '0711000002': { profile: 'logos/bloomfield.png' },
  '0711000003': { profile: 'logos/lakeside.png' },
  '0711000007': { profile: 'organizers/mvua.jpg' },
  '0711000008': { profile: 'organizers/kilele.jpg' },
  '0711000009': { profile: 'organizers/anga.jpg' },

  // Crew
  '0711000004': {
    cover: 'covers/concert-wide.jpg',
    portfolio: portfolio('concert-left', 'stage-performer', 'sax-player', 'concert-right', 'dj-hands', 'stage-band'),
  },
  '0711000010': crew('kevin'),
  '0711000011': crew('juma'),
  '0711000012': crew('faith'),
  '0711000013': crew('grace'),
  '0711000014': crew('dennis', { portfolio: [1, 2, 3, 4].map((number) => `crew/dennis-portfolio-${number}.jpg`) }),
  '0711000015': crew('wairimu', { portfolio: portfolio('stage-band', 'dj-hands', 'concert-right') }),
  '0711000016': crew('collins'),
};

module.exports = { DEMO_PICTURES };
