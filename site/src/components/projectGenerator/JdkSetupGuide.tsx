/*
 * Per-vendor, per-OS JDK install walk-through. Shown beneath the project
 * generator (and on the Pong tutorial page) so users do not have to leave
 * the site to figure out where to grab a JDK.
 *
 * The picks-per-OS reflect each vendor's officially-supported channel —
 * package managers where they exist (so the user gets updates), and a
 * fall-back tarball/installer link otherwise.
 */
import {useState, type JSX} from 'react';
import type {JdkVendor} from './templates';
import styles from './JdkSetupGuide.module.css';

type OS = 'windows' | 'macos' | 'ubuntu' | 'fedora' | 'arch';

interface InstallSteps {
  intro: string;          // 1 sentence framing
  commands?: string[];    // shell/powershell snippet (already formatted)
  notes?: string[];       // bullet points after the snippet
  download?: {
    label: string;
    href: string;
  };
}

/* ------------------------------------------------------------------------- *
 * Instructions per (vendor × OS). Where a vendor has no first-party channel
 * on an OS, we fall back to the vendor's downloads page.
 * ------------------------------------------------------------------------- */
const INSTRUCTIONS: Record<JdkVendor, Record<OS, InstallSteps>> = {
  graalvm: {
    windows: {
      intro:
        'Use the official PowerShell one-liner from graalvm.org — sets PATH and JAVA_HOME for you.',
      commands: [
        '# In PowerShell (as Administrator)',
        'iwr https://download.oracle.com/graalvm/17/latest/graalvm-jdk-17_windows-x64_bin.zip -OutFile graalvm.zip',
        'Expand-Archive graalvm.zip -DestinationPath C:\\graalvm',
      ],
      notes: [
        'Add `C:\\graalvm\\graalvm-jdk-17\\bin` to PATH.',
        'Set `JAVA_HOME=C:\\graalvm\\graalvm-jdk-17`.',
      ],
    },
    macos: {
      intro: 'Use SDKMAN or Homebrew — SDKMAN is the friendliest if you switch JDKs often.',
      commands: [
        'curl -s "https://get.sdkman.io" | bash',
        'sdk install java 17-graal',
      ],
    },
    ubuntu: {
      intro: 'Use SDKMAN (works on any Linux distro with bash).',
      commands: [
        'curl -s "https://get.sdkman.io" | bash',
        'source "$HOME/.sdkman/bin/sdkman-init.sh"',
        'sdk install java 17-graal',
      ],
    },
    fedora: {
      intro: 'Same SDKMAN one-liner works on Fedora.',
      commands: [
        'curl -s "https://get.sdkman.io" | bash',
        'source "$HOME/.sdkman/bin/sdkman-init.sh"',
        'sdk install java 17-graal',
      ],
    },
    arch: {
      intro: 'Install from the AUR or via SDKMAN.',
      commands: ['yay -S jdk17-graalvm-bin'],
    },
  },
  temurin: {
    windows: {
      intro: 'Use the official MSI installer from Adoptium.',
      download: {
        label: 'Download Temurin MSI',
        href: 'https://adoptium.net/temurin/releases/?package=jdk&version=17',
      },
      notes: ['Tick "Set JAVA_HOME" and "Add to PATH" during the install wizard.'],
    },
    macos: {
      intro: 'One Homebrew command.',
      commands: ['brew install --cask temurin@17'],
    },
    ubuntu: {
      intro: 'Adoptium maintains an official apt repo.',
      commands: [
        'wget -qO- https://packages.adoptium.net/artifactory/api/gpg/key/public \\',
        '  | sudo gpg --dearmor -o /usr/share/keyrings/adoptium.gpg',
        'echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] \\',
        '  https://packages.adoptium.net/artifactory/deb $(lsb_release -cs) main" \\',
        '  | sudo tee /etc/apt/sources.list.d/adoptium.list',
        'sudo apt update && sudo apt install -y temurin-17-jdk',
      ],
    },
    fedora: {
      intro: 'Use dnf via the official Adoptium repo.',
      commands: [
        'sudo dnf install https://packages.adoptium.net/artifactory/rpm/fedora/$(rpm -E %fedora)/adoptium.repo',
        'sudo dnf install -y temurin-17-jdk',
      ],
    },
    arch: {
      intro: 'Available in the extra repository.',
      commands: ['sudo pacman -S jdk17-openjdk'],
      notes: ['Arch ships HotSpot OpenJDK which is binary-compatible with Temurin.'],
    },
  },
  corretto: {
    windows: {
      intro: 'Use the official MSI installer from Amazon.',
      download: {
        label: 'Download Corretto MSI',
        href: 'https://docs.aws.amazon.com/corretto/latest/corretto-17-ug/downloads-list.html',
      },
    },
    macos: {
      intro: 'Homebrew tap for Corretto.',
      commands: ['brew install --cask corretto@17'],
    },
    ubuntu: {
      intro: 'Amazon maintains an apt repo.',
      commands: [
        'wget -O- https://apt.corretto.aws/corretto.key \\',
        '  | sudo gpg --dearmor -o /usr/share/keyrings/corretto.gpg',
        'echo "deb [signed-by=/usr/share/keyrings/corretto.gpg] https://apt.corretto.aws stable main" \\',
        '  | sudo tee /etc/apt/sources.list.d/corretto.list',
        'sudo apt update && sudo apt install -y java-17-amazon-corretto-jdk',
      ],
    },
    fedora: {
      intro: 'Use the official Amazon yum repo.',
      commands: [
        'sudo rpm --import https://yum.corretto.aws/corretto.key',
        'sudo curl -L -o /etc/yum.repos.d/corretto.repo https://yum.corretto.aws/corretto.repo',
        'sudo dnf install -y java-17-amazon-corretto-devel',
      ],
    },
    arch: {
      intro: 'Available in the AUR.',
      commands: ['yay -S amazon-corretto-17'],
    },
  },
  zulu: {
    windows: {
      intro: 'Use the official Zulu MSI installer from Azul.',
      download: {
        label: 'Download Azul Zulu MSI',
        href: 'https://www.azul.com/downloads/?package=jdk',
      },
    },
    macos: {
      intro: 'Homebrew cask.',
      commands: ['brew install --cask zulu@17'],
    },
    ubuntu: {
      intro: 'Azul maintains an apt repo.',
      commands: [
        'sudo apt install -y gnupg ca-certificates curl',
        'curl -s https://repos.azul.com/azul-repo.key | sudo gpg --dearmor -o /usr/share/keyrings/azul.gpg',
        'echo "deb [signed-by=/usr/share/keyrings/azul.gpg] https://repos.azul.com/zulu/deb stable main" \\',
        '  | sudo tee /etc/apt/sources.list.d/zulu.list',
        'sudo apt update && sudo apt install -y zulu17-jdk',
      ],
    },
    fedora: {
      intro: 'Use the official Azul rpm repo.',
      commands: [
        'sudo rpm --import https://repos.azul.com/azul-repo.key',
        'sudo curl -o /etc/yum.repos.d/zulu.repo https://repos.azul.com/zulu/rpm/zulu-repo.repo',
        'sudo dnf install -y zulu17-jdk',
      ],
    },
    arch: {
      intro: 'Available in the AUR.',
      commands: ['yay -S zulu-17-bin'],
    },
  },
};

const OS_TABS: {id: OS; label: string}[] = [
  {id: 'windows', label: 'Windows'},
  {id: 'macos', label: 'macOS'},
  {id: 'ubuntu', label: 'Ubuntu / Debian'},
  {id: 'fedora', label: 'Fedora / RHEL'},
  {id: 'arch', label: 'Arch'},
];

interface Props {
  vendor: JdkVendor;
  vendorLabel?: string;
}

/**
 * Quick "verify it worked" snippet that we show at the bottom of every tab,
 * so users always finish by running the same `java -version` sanity check.
 */
const VERIFY_HINT = 'After install, open a new terminal and run `java -version`.';

export default function JdkSetupGuide({vendor, vendorLabel}: Props): JSX.Element {
  const [os, setOs] = useState<OS>('windows');
  const steps = INSTRUCTIONS[vendor][os];
  return (
    <div className={styles.wrap}>
      <div className={styles.tabRow} role="tablist">
        {OS_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={os === t.id}
            className={`${styles.tab} ${os === t.id ? styles.tabActive : ''}`}
            onClick={() => setOs(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        <p className={styles.intro}>
          <strong>{vendorLabel ?? vendor}</strong> on{' '}
          <strong>{OS_TABS.find((t) => t.id === os)?.label}</strong>: {steps.intro}
        </p>
        {steps.commands && (
          <pre className={styles.code}>
            <code>{steps.commands.join('\n')}</code>
          </pre>
        )}
        {steps.notes && (
          <ul className={styles.notes}>
            {steps.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {steps.download && (
          <a className={styles.dlBtn} href={steps.download.href} target="_blank" rel="noreferrer">
            {steps.download.label} ↗
          </a>
        )}
        <div className={styles.verify}>{VERIFY_HINT}</div>
      </div>
    </div>
  );
}
