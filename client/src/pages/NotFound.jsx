import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import usePageMeta from '../usePageMeta.js';
import { NOT_FOUND_META } from '../pageMeta.js';

// The 404 page - any address the app doesn't know. KREW is about crew who turn up, so this
// page is the one that didn't: a backstage pass for a no-show, swinging on its lanyard under
// two stage lights. The server answers these addresses with a real 404 status as well
// (server/src/pageMeta.js), so search engines don't index them.
export default function NotFound() {
  usePageMeta(NOT_FOUND_META);
  const { pathname } = useLocation();

  return (
    <div className="krew-public-page">
      <PublicNav />

      <main className="krew-404">
        <span className="krew-shard krew-404-beam krew-404-beam-left" aria-hidden="true" />
        <span className="krew-shard krew-404-beam krew-404-beam-right" aria-hidden="true" />

        <div className="krew-404-inner">
          <div className="krew-404-copy">
            <p className="krew-404-eyebrow">Error 404 · Page not found</p>
            <h1>
              This page is a <em>no‑show.</em>
            </h1>
            <p className="krew-404-text">
              We checked the call sheet, the green room and behind the stage. Whatever was meant to be at this
              address isn't here - the link may be old, or mistyped.
            </p>
            <div className="krew-404-actions">
              <Link to="/" className="krew-button-primary krew-button-inline">
                Back to the homepage <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <Link to="/find-work" className="krew-text-link">
                Find work
              </Link>
              <Link to="/hire-crew" className="krew-text-link">
                Hire crew
              </Link>
            </div>
          </div>

          <div className="krew-404-pass-wrap" aria-hidden="true">
            <div className="krew-404-lanyard" />
            <div className="krew-404-pass">
              <div className="krew-404-pass-clip" />
              <div className="krew-404-pass-head">
                <img src="/brand/krew-mark-light.webp" alt="" width="34" height="34" />
                <span>Crew pass</span>
              </div>
              <div className="krew-404-pass-number">404</div>
              <dl className="krew-404-pass-rows">
                <div>
                  <dt>Call time</dt>
                  <dd>Now</dd>
                </div>
                <div>
                  <dt>Station</dt>
                  <dd className="krew-404-pass-path">{pathname}</dd>
                </div>
                <div>
                  <dt>Checked in</dt>
                  <dd>Never</dd>
                </div>
              </dl>
              <div className="krew-404-pass-stamp">No-show</div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
