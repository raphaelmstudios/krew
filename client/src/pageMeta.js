// Page titles and descriptions, in one place. Used twice:
// - in the browser, by usePageMeta (src/usePageMeta.js), so the tab title changes as you move
//   around the app;
// - on the server (server/src/pageMeta.js imports this file), which writes the right title,
//   description and share-image tags into the HTML before it's sent - that's the version
//   Google, WhatsApp, Facebook and X read, since they don't run the app's JavaScript.
// Titles stay under 60 characters and descriptions under 155, so search results and link
// previews show them whole.

export const SITE_NAME = 'KREW';

export const PAGE_META = {
  '/': {
    title: 'KREW · Hire event crew and find paid gigs in Nairobi',
    description:
      'Hire verified event crew or find paid gigs in Nairobi. Both sides confirm every payment, building records you can check before you agree.',
  },
  '/find-work': {
    title: 'Find paid event gigs in Nairobi · KREW',
    description:
      "Browse open event gigs in Nairobi - bar service, security, sound, ushering and more - and see each organizer's payment record before applying.",
  },
  '/hire-crew': {
    title: 'Hire verified event crew in Nairobi · KREW',
    description:
      'Find ID-verified bartenders, security, ushers, photographers and sound engineers in Nairobi, each with a record of payment-confirmed jobs.',
  },
  '/login': {
    title: 'Log in · KREW',
    description: 'Log in to KREW to manage your gigs, applications, hires and payment confirmations.',
  },
  '/register': {
    title: 'Create your account · KREW',
    description:
      'Join KREW as an event organizer or as crew. Verify your ID once, then post gigs, apply for work and build a payment record both sides trust.',
  },
  '/verify': {
    title: 'Verify your identity · KREW',
    description: 'Upload a photo of your ID and a selfie so the KREW team can review and approve your account.',
  },
  '/forgot-password': {
    title: 'Forgot your password? · KREW',
    description: 'Ask for a password reset. A KREW admin calls the number on your account to confirm it is you, then gives you a one-time code.',
  },
  '/reset-password': {
    title: 'Set a new password · KREW',
    description: 'Enter the one-time code a KREW admin gave you and choose a new password for your account.',
  },
  '/faq': {
    title: 'FAQ: how KREW payment records work · KREW',
    description:
      'What "New here", on-time percentages and completed jobs mean on KREW, how payment confirmation works, and how to raise a dispute.',
  },
  '/terms': {
    title: 'Terms of Service · KREW',
    description: 'The terms for using KREW to post event gigs, hire crew, apply for work and confirm payments in Nairobi.',
  },
  '/privacy': {
    title: 'Privacy Policy · KREW',
    description:
      'What KREW collects - including your ID and selfie - why, who can see each part, and how long it is kept.',
  },
  '/dashboard': {
    title: 'Your dashboard · KREW',
    description: 'Your KREW dashboard.',
  },
  '/admin': {
    title: 'Admin · KREW',
    description: 'KREW admin panel.',
  },
};

export const NOT_FOUND_META = {
  title: 'Page not found · KREW',
  description: "This page doesn't exist on KREW. Head back to the homepage to find gigs or hire event crew in Nairobi.",
};

// Signed-in areas: kept out of search engines (robots.txt and a noindex tag).
export const PRIVATE_PATHS = ['/dashboard', '/admin', '/verify'];

// Shortens text to a maximum length on a word boundary, with an ellipsis.
export function clip(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}

export function sectionTitle(sectionLabel, area = 'KREW') {
  return clip(`${sectionLabel} · ${area}`, 60);
}

// A single open gig (GigDetail page).
export function gigMeta(listing) {
  const title = clip(`${listing.title || 'Event gig'} · ${listing.location || 'Nairobi'}`, 53);
  const due = new Date(listing.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const who = listing.organizer_name ? `${listing.organizer_name}'s` : "the organizer's";
  return {
    title: `${title} · KREW`,
    description: clip(
      `${listing.category || 'Event'} gig in ${listing.location || 'Nairobi'} paying KES ${Number(listing.amount).toLocaleString('en-US')}, due ${due}. See ${who} payment record and apply on KREW.`,
      155
    ),
  };
}

// A crew member's public profile (CrewProfile page).
export function crewMeta(profile) {
  const role = profile.professional_role || 'Event crew';
  const jobs = profile.confirmed_job_count
    ? `${profile.confirmed_job_count} completed, payment-confirmed ${profile.confirmed_job_count === 1 ? 'job' : 'jobs'} on KREW.`
    : 'New on KREW.';
  const years = profile.years_experience ? `, ${profile.years_experience}+ years' experience` : '';
  return {
    title: clip(`${profile.name} · ${role} · KREW`, 60),
    description: clip(`${profile.name}, ${role.toLowerCase()} in Nairobi${years}. ${jobs} See their portfolio and verified work history.`, 155),
  };
}
