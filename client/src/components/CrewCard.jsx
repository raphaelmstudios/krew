import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import InfoTooltip from './InfoTooltip.jsx';

// Shared by Hire Crew's directory grid and the "More crew" row at the bottom of a crew profile.

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// Formats the crew member's record for display in the directory.
// If they have no confirmed jobs, show a "New here" badge. Otherwise, show the number of completed jobs with proper pluralization. Either way it comes with a small info icon explaining what the badge means.
export function formatCrewRecord(crewMember) {
  if (!crewMember.confirmed_job_count) {
    return (
      <>
        <span className="krew-status-pill new">New here</span>
        <InfoTooltip text="New here means this crew member hasn't completed a job on KREW yet - everyone starts without a track record, it isn't a red flag." />
      </>
    );
  }
  const jobWord = crewMember.confirmed_job_count === 1 ? 'job' : 'jobs';
  return (
    <>
      {crewMember.confirmed_job_count} completed {jobWord}
      <InfoTooltip text="The number of jobs this crew member has completed and had payment confirmed on KREW." />
    </>
  );
}

// The crew member's own photo, or a plum panel with their initials when they haven't added one.
function CrewPortrait({ crewMember }) {
  if (crewMember.profile_photo_path) {
    return (
      <div className="krew-hc-card-photo">
        <img src={`/uploads/${crewMember.profile_photo_path}`} alt="" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="krew-hc-card-photo placeholder" aria-hidden="true">
      <span className="krew-shard krew-hc-card-shard" />
      <span className="krew-hc-card-initials">{initials(crewMember.name)}</span>
    </div>
  );
}

export default function CrewCard({ crewMember }) {
  return (
    <Link to={`/crew/${crewMember.id}`} className="krew-hc-card">
      <div className="krew-hc-card-media">
        <CrewPortrait crewMember={crewMember} />
        <span className={`krew-hc-availability ${crewMember.availability_status === 'available' ? 'available' : 'working'}`}>
          {crewMember.availability_status === 'available' ? 'Available' : 'Currently working'}
        </span>
      </div>
      <div className="krew-hc-card-body">
        <h3>{crewMember.name}</h3>
        <p className="krew-hc-card-role">
          {crewMember.professional_role || 'Event crew'}
          {crewMember.years_experience ? ` · ${crewMember.years_experience}+ yrs` : ''}
        </p>
        {crewMember.skills.length > 0 && (
          <div className="krew-hc-skills">
            {crewMember.skills.slice(0, 3).map((skill) => (
              <span className="krew-crew-skill-chip" key={skill}>{skill}</span>
            ))}
            {crewMember.skills.length > 3 && (
              <span className="krew-crew-skill-chip more">+{crewMember.skills.length - 3}</span>
            )}
          </div>
        )}
        <div className="krew-hc-card-record">{formatCrewRecord(crewMember)}</div>
        <span className="krew-button-primary krew-button-inline krew-hc-card-cta">
          View Profile <ArrowRight size={15} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}
