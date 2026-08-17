import React from 'react';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { ProblemSection } from './components/ProblemSection';
import { ApproachSection } from './components/ApproachSection';
import { RouteIntelligence } from './components/RouteIntelligence';
import { DynamicRerouting } from './components/DynamicRerouting';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { useReveal } from './hooks/useReveal';

import './styles/global.css';
import './components/ui/ui.css';
import './components/nav.css';
import './components/hero.css';
import './components/problem.css';
import './components/approach.css';
import './components/routes.css';
import './components/adaptive.css';
import './components/cta.css';
import './components/map/map.css';

interface LandingPageProps {
  onLaunchDashboard?: () => void;
}

export default function LandingPage({ onLaunchDashboard }: LandingPageProps) {
  useReveal();

  return (
    <div className="landing-root">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav onLaunchDashboard={onLaunchDashboard} />
      <main id="main">
        <span id="top" />
        <Hero onLaunchDashboard={onLaunchDashboard} />
        <ProblemSection />
        <ApproachSection />
        <RouteIntelligence />
        <DynamicRerouting />
        <FinalCTA onLaunchDashboard={onLaunchDashboard} />
      </main>
      <Footer />
    </div>
  );
}
