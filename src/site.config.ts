/**
 * Every personal fact, link and feature flag lives in this file.
 * Pages and components read from here and never hard-code a fact.
 */
export type Lang = 'en' | 'de';
type Localised = Record<Lang, string>;

export interface Skill {
  /** Shown as written. Add `de` only where the German term differs. */
  label: string;
  de?: string;
  /** Slug of the project that shows this skill in use. */
  project?: string;
  /** Or the slug of a write-up that does. */
  writeup?: string;
}

export const site = {
  url: 'https://devnxh.github.io',
  name: 'Devansh Vadher',
  /** Used in the file-header block on Home. */
  fileName: 'devansh_vadher.md',
  location: { en: 'Bhavnagar, Gujarat, India', de: 'Bhavnagar, Gujarat, Indien' } satisfies Localised,
  repo: 'https://github.com/devnxh/devnxh.github.io',
  /** Branch that holds the vault, for "View source on GitHub" links. */
  branch: 'main',

  links: {
    github: 'https://github.com/devnxh',
    linkedin: 'https://www.linkedin.com/in/devansh-vadher-805229299',
    tryhackme: 'https://tryhackme.com/p/devnxh',
  },

  /**
   * Kept in two parts so the address never appears whole in the HTML or in
   * this repository. The Email component joins them in the browser.
   */
  email: { user: 'ddvadher2003', domain: 'gmail.com' },

  /** Shown only when the file exists in `public/` at build time. */
  cvPath: '/cv/Devansh_Vadher_CV.pdf',
  photoPath: '/me.jpg',

  positioning: {
    en: 'I test systems the way an attacker would and take binaries apart to see what they do, then write up exactly what I found.',
    de: 'Ich prüfe Systeme so, wie ein Angreifer es täte, zerlege Binärdateien, um zu sehen, was sie tun, und halte genau fest, was ich gefunden habe.',
  } satisfies Localised,
  /** The words in the positioning line that get the hand-drawn underline. */
  positioningEmphasis: { en: 'exactly what I found', de: 'was ich gefunden habe' } satisfies Localised,

  status: {
    en: 'Open to Security Analyst / SOC L1 roles · India or remote · available now',
    de: 'Offen für Stellen als Security Analyst / SOC L1 · Indien oder remote · ab sofort verfügbar',
  } satisfies Localised,

  description: {
    en: 'Devansh Vadher, entry-level security analyst. Penetration testing, static malware analysis, reverse engineering, Python security tools, and write-ups.',
    de: 'Devansh Vadher, Security Analyst am Berufsanfang. Penetrationstests, statische Malware-Analyse, Reverse Engineering, Python-Sicherheitswerkzeuge und Write-ups.',
  } satisfies Localised,

  targetRoles: ['Security Analyst', 'SOC Analyst L1', 'Information Security Analyst'],
  availability: { en: 'Immediately', de: 'Ab sofort' } satisfies Localised,
  workSetup: {
    en: 'On-site or hybrid in India, or remote',
    de: 'Vor Ort oder hybrid in Indien, oder remote',
  } satisfies Localised,
  languages: {
    en: 'English (C1, IELTS 7.5) · Gujarati and Hindi (native) · German (A1, learning)',
    de: 'Englisch (C1, IELTS 7.5) · Gujarati und Hindi (Muttersprache) · Deutsch (A1, lerne ich)',
  } satisfies Localised,

  /** The four facts under the masthead. Each links to its evidence. */
  proof: [
    {
      label: { en: 'TryHackMe · top 5%', de: 'TryHackMe · Top 5 %' },
      href: 'https://tryhackme.com/p/devnxh',
    },
    {
      label: {
        en: 'Google Cybersecurity Professional Certificate · Jun 2026',
        de: 'Google Cybersecurity Professional Certificate · Juni 2026',
      },
      href: 'https://coursera.org/verify/professional-cert/43V4YPYMG9Z4',
    },
    {
      label: {
        en: "Principal's Choice Award · TechXcellence-2025",
        de: "Principal's Choice Award · TechXcellence-2025",
      },
      /** Internal: resolved per language. */
      project: 'voicevista',
    },
    {
      label: { en: 'B.E. Information Technology · CGPA 8.20/10', de: 'B.E. Informationstechnik · CGPA 8,20/10' },
      page: 'about',
      /** The heading on About. Its anchor differs per language. */
      hash: { en: 'education', de: 'ausbildung' },
    },
  ] as Array<{ label: Localised; href?: string; project?: string; page?: string; hash?: Localised }>,

  toolbox: [
    {
      title: { en: 'Security', de: 'Sicherheit' },
      skills: [
        { label: 'network and web security', de: 'Netzwerk- und Web-Sicherheit' },
        { label: 'static malware analysis', de: 'statische Malware-Analyse', project: 'pe-sentinel' },
        { label: 'YARA', project: 'pe-sentinel' },
        { label: 'reverse engineering', de: 'Reverse Engineering', writeup: 'crackme-2' },
        { label: 'GDB', writeup: 'crackme-1' },
        { label: 'Wireshark' },
        { label: 'SIEM basics', de: 'SIEM-Grundlagen' },
        { label: 'IDS' },
        { label: 'incident response', de: 'Incident Response' },
        { label: 'cryptography basics', de: 'Kryptografie-Grundlagen' },
      ],
    },
    {
      title: { en: 'Systems and networking', de: 'Systeme und Netzwerke' },
      skills: [
        { label: 'Linux' },
        { label: 'TCP/IP' },
        { label: 'shell scripting', de: 'Shell-Skripte' },
        { label: 'Windows' },
        { label: 'Docker' },
        { label: 'virtualisation', de: 'Virtualisierung' },
      ],
    },
    {
      title: { en: 'Programming', de: 'Programmierung' },
      skills: [
        { label: 'Python', project: 'pe-sentinel' },
        { label: 'SQL' },
        { label: 'C' },
        { label: 'Java' },
        { label: 'x86-64 assembly', de: 'x86-64-Assembler', writeup: 'crackme-2' },
      ],
    },
    {
      title: { en: 'Testing and development', de: 'Testen und Entwicklung' },
      skills: [
        { label: 'manual and functional testing', de: 'manuelles und funktionales Testen', project: 'speech-therapy' },
        { label: 'test case design', de: 'Testfallentwurf', project: 'speech-therapy' },
        { label: 'pytest', project: 'pe-sentinel' },
        { label: 'FastAPI', project: 'speech-therapy' },
        { label: 'React', project: 'speech-therapy' },
        { label: 'Firebase', project: 'speech-therapy' },
        { label: 'REST APIs', de: 'REST-APIs' },
        { label: 'Git and GitHub', de: 'Git und GitHub' },
      ],
    },
  ] as Array<{ title: Localised; skills: Skill[] }>,

  /** Phase 4 extras. All off until asked for. */
  features: {
    graphView: false,
    heroLoop: false,
    /** GoatCounter site code, for example `devnxh`. Empty means no analytics. */
    goatCounter: '',
  },
} as const;

export const LANGS: readonly Lang[] = ['en', 'de'];
export const DEFAULT_LANG: Lang = 'en';
