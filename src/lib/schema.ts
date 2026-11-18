/**
 * schema.org objects shared across pages, so search engines see one consistent
 * person behind the site, its projects and its write-ups.
 */
import { site, type Lang } from '../site.config';

export const PERSON_ID = `${site.url}/#person`;
export const WEBSITE_ID = `${site.url}/#website`;

/** A reference to the person, for `author` fields. */
export const personRef = { '@type': 'Person', '@id': PERSON_ID, name: site.name, url: `${site.url}/` };

export function personSchema(lang: Lang, description = site.description[lang]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: site.name,
    givenName: 'Devansh',
    familyName: 'Vadher',
    alternateName: 'devnxh',
    url: `${site.url}/`,
    image: `${site.url}/og/index.png`,
    jobTitle: 'Security Analyst',
    description,
    address: { '@type': 'PostalAddress', addressLocality: 'Bhavnagar', addressRegion: 'Gujarat', addressCountry: 'IN' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Government Engineering College Bhavnagar' },
    knowsAbout: [
      'Penetration testing',
      'Vulnerability assessment',
      'Reverse engineering',
      'Static malware analysis',
      'Capture the flag',
      'Python',
      'Linux',
    ],
    knowsLanguage: ['en', 'gu', 'hi', 'de'],
    sameAs: Object.values(site.links),
  };
}

/** The site itself. Google uses `name` here as the site name in results. */
export function websiteSchema(lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: site.name,
    alternateName: ['devnxh', `${site.name} portfolio`],
    url: `${site.url}/`,
    inLanguage: lang,
    publisher: { '@id': PERSON_ID },
  };
}

/** Marks a page as being about the person (Home, About). */
export function profilePageSchema(lang: Lang, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    inLanguage: lang,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: { '@id': PERSON_ID },
  };
}
