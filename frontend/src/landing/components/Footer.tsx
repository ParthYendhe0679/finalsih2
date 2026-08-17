import { SECTIONS } from '../config';

export function Footer() {
  return (
    <footer className="foot">
      <div className="shell foot__inner">
        <div className="foot__brand">
          <div className="mark">
            <img src="/logo.jpg" alt="Sagar Setu" className="mark__img" width="40" height="40" />
            <img src="/sagar-setu-title.png" alt="सागर सेतु" className="mark__title-img" height="34" />
          </div>
          <p className="foot__tag">Dynamic maritime voyage optimization for the Indian Ocean basin.</p>
        </div>

        <nav className="foot__nav" aria-label="Footer">
          <a href={`#${SECTIONS.problem}`}>The problem</a>
          <a href={`#${SECTIONS.approach}`}>Approach</a>
          <a href={`#${SECTIONS.routes}`}>Route intelligence</a>
          <a href={`#${SECTIONS.adaptive}`}>Adaptive rerouting</a>
        </nav>
      </div>

      <div className="shell foot__base">
        <p className="mono-label">Smart India Hackathon · Maritime</p>
        <p className="mono-label">Figures shown are illustrative</p>
      </div>
    </footer>
  );
}
