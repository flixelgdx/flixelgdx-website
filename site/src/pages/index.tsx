import {type JSX, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import FadeIn from '@site/src/components/FadeIn';

import styles from './index.module.css';

const FEATURES = [
  {
    icon: '🚀',
    title: 'Beginner friendly, expert powerful',
    body: 'Familiar Flixel-shaped states, sprites, groups, tweens and timers, plus the full power of libGDX when you need it. No magic, no walls.',
  },
  {
    icon: '⚡',
    title: 'Featherweight & fast',
    body: 'Designed to bring the features of modern game engines to low-end hardware. A FlixelGDX game runs happily inside a 16 MB JVM heap.',
  },
  {
    icon: '🎯',
    title: 'Built on libGDX',
    body: 'Cross-platform windowing, OpenGL, input and audio under the hood — but with the friendly Flixel API on top.',
  },
  {
    icon: '🌐',
    title: 'Multiplatform',
    body: 'Ship to LWJGL3 desktop and to the browser via TeaVM. Mobile (Android & iOS) backends are on the way.',
  },
  {
    icon: '🧰',
    title: 'Batteries included',
    body: 'Tweens, timers, animations, bitmap text, audio helpers, saves, input actions, powerful debugging tools and more — all out of the box just for you.',
  },
  {
    icon: '☕',
    title: 'Java 17 + Gradle',
    body: 'Modern Java, records, switches, lambdas. A clean Gradle multi-module split that grows with your project.',
  },
  {
    icon: '🐞',
    title: 'Debug-friendly',
    body: 'In-game watches, a logger that captures file + line, and an optional ImGui-powered overlay so you can see what your game is doing.',
  },
  {
    icon: '📦',
    title: 'Drop-in with JitPack',
    body: 'No publishing dance — point Gradle at JitPack, pick a tag, you are done. The Getting Started page even generates the project for you.',
  },
  {
    'icon': '🎁',
    'title': '100% free and open source',
    'body': 'The best part of all, FlixelGDX is completely free for you to use in any project, personal or commercial. Contributions are always welcome!',
  }
];

const HERO_CODE = `// Switch states.
Flixel.switchState(new MyGameState());

// Play a sound.
Flixel.sound.play("explosion.mp3");

// Check if a key is pressed.
if (Flixel.keys.justPressed(FlixelKeys.SPACE)) {
  player.jump();
}`;

function HeroBadges(): JSX.Element {
  return (
    <div className={styles.heroBadges}>
      <span className={styles.heroBadge}>Java 17+</span>
      <span className={styles.heroBadge}>libGDX under the hood</span>
      <span className={styles.heroBadge}>MIT licensed</span>
      <span className={styles.heroBadge}>Runs in 4-8 MB average heap</span>
    </div>
  );
}

function Hero(): JSX.Element {
  const logo = useBaseUrl('/img/logo-square.png');
  return (
    <header className={styles.hero}>
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className="container">
        <div className={styles.heroInner}>
          <img className={styles.heroLogo} src={logo} alt="FlixelGDX logo" />
          <h1 className={styles.heroTitle}>FlixelGDX</h1>
          <p className={styles.heroTag}>
            The most powerful Java game development framework, designed for
            beginners and experts alike.
          </p>
          <div className={styles.heroButtons}>
            <Link className="flx-btn flx-btn--primary" to="/learn/getting-started">
              Get started
            </Link>
            <Link className="flx-btn flx-btn--ghost" to="/learn/your-first-project">
              Your first project
            </Link>
            <Link className="flx-btn flx-btn--ghost" to="/api/">
              API reference
            </Link>
            <Link
              className="flx-btn flx-btn--ghost"
              href="https://github.com/flixelgdx/flixelgdx"
            >
              View source
            </Link>
          </div>
          <HeroBadges />
        </div>
      </div>
    </header>
  );
}

function FeatureGrid(): JSX.Element {
  return (
    <section className={styles.section} id="features">
      <div className={styles.sectionInner}>
        <FadeIn>
          <h2 className={styles.sectionTitle}>Why FlixelGDX?</h2>
          <p className={styles.sectionLead}>
            Modern game-engine ergonomics, the welcoming Flixel API, and the
            performance budget of a feather. Perfect for first-time game devs,
            game jams, classrooms, and serious indie projects alike.
          </p>
        </FadeIn>
        <div className={styles.grid}>
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 60} className="flx-card">
              <span className={styles.featureIcon} aria-hidden="true">
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeShowcase(): JSX.Element {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.split}>
          <FadeIn>
            <span className={styles.kicker}>Friendly API</span>
            <h2 className={styles.splitTitle}>
              Reads like Flixel. Runs like libGDX.
            </h2>
            <p className={styles.splitLead}>
              The static <code>Flixel</code> facade exposes every system you
              need — states, sprites, input, audio, signals and timers — with
              an API that feels like home if you have ever used HaxeFlixel.
            </p>
            <ul className={styles.checkList}>
              <li>States &amp; substates that stack like scenes.</li>
              <li>Sprite groups with batched update &amp; draw.</li>
              <li>Tweens, timers, and a debug overlay out of the box.</li>
              <li>Input action sets for keyboard, mouse &amp; controllers.</li>
            </ul>
          </FadeIn>
          <FadeIn delay={80}>
            <div className={styles.splitFigure}>
              <CodeBlock language="java">{HERO_CODE}</CodeBlock>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function LowEndCallout(): JSX.Element {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <FadeIn className={styles.cta}>
          <h2 className={styles.ctaTitle}>
            Modern engines, classic hardware.
          </h2>
          <p className={styles.ctaLead}>
            FlixelGDX is engineered for memory-efficient, frame-stable
            gameplay even on low-end PCs and old laptops. The default project
            template ships with a 16 MB JVM heap — that is more than plenty
            for a FlixelGDX game to run smoothly.
          </p>
          <div className={styles.heroButtons}>
            <Link className="flx-btn flx-btn--primary" to="/learn/getting-started">
              Generate a project
            </Link>
            <Link className="flx-btn flx-btn--ghost" to="/api/">
              Browse the API
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}
    >
      <Hero />
      <div className="flx-pixel-rule container" aria-hidden="true" />
      <main>
        <FeatureGrid />
        <CodeShowcase />
        <LowEndCallout />
      </main>
    </Layout>
  );
}
