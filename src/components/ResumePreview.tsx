/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { CommitCVResume, ResumeContact } from '../types';
import { getResumeFormatOption, ResumeFormatId, resolveResumeFormat } from '../resumeFormats';

interface ResumePreviewProps {
  resume: CommitCVResume;
  formatId?: ResumeFormatId | string;
  username?: string;
  newlyAddedSkills?: string[];
  showOpenSource?: boolean;
}

function sectionTitle(label: string, className = '') {
  return (
    <h3 className={`resume-section-title ${className}`}>
      {label}
    </h3>
  );
}

function joinSkills(items?: string[], highlight: string[] = []) {
  if (!items?.length) return null;
  return items.map((item, i) => (
    <span key={item}>
      {i > 0 ? ', ' : ''}
      <span className={highlight.includes(item) ? 'resume-skill-new' : undefined}>{item}</span>
    </span>
  ));
}

function SkillLines({
  skills,
  newlyAddedSkills = [],
  compact = false,
}: {
  skills: CommitCVResume['skills'];
  newlyAddedSkills?: string[];
  compact?: boolean;
}) {
  if (!skills) return null;
  const groups = [
    { label: 'Languages', items: skills.languages },
    { label: 'Frameworks', items: skills.frameworks },
    { label: 'Databases', items: skills.databases },
    { label: 'Tools', items: skills.tools },
  ].filter((g) => g.items?.length);

  if (!groups.length) return null;

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {groups.map((group) => (
        <p key={group.label} className="resume-body-text leading-snug">
          <span className="font-semibold text-slate-800">{group.label}: </span>
          {joinSkills(group.items, newlyAddedSkills)}
        </p>
      ))}
    </div>
  );
}

function ContactBlock({
  contact,
  githubHandle,
  inline = false,
}: {
  contact?: ResumeContact;
  githubHandle: string;
  inline?: boolean;
}) {
  const lines: { key: string; value: string; href?: string }[] = [];

  if (contact?.location) lines.push({ key: 'location', value: contact.location });
  if (contact?.email) lines.push({ key: 'email', value: contact.email, href: `mailto:${contact.email}` });
  if (contact?.phone) lines.push({ key: 'phone', value: contact.phone });
  if (contact?.age) lines.push({ key: 'age', value: contact.age });
  if (contact?.website) {
    const url = contact.website.startsWith('http') ? contact.website : `https://${contact.website}`;
    lines.push({ key: 'website', value: contact.website.replace(/^https?:\/\//, ''), href: url });
  }
  if (contact?.linkedin) {
    const url = contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`;
    lines.push({ key: 'linkedin', value: contact.linkedin.replace(/^https?:\/\//, ''), href: url });
  }
  if (contact?.twitter) {
    const url = contact.twitter.startsWith('http') ? contact.twitter : `https://${contact.twitter}`;
    lines.push({ key: 'twitter', value: contact.twitter.replace(/^https?:\/\//, ''), href: url });
  }
  if (contact?.instagram) {
    const url = contact.instagram.startsWith('http') ? contact.instagram : `https://${contact.instagram}`;
    lines.push({ key: 'instagram', value: contact.instagram.replace(/^https?:\/\//, ''), href: url });
  }
  if (contact?.facebook) {
    const url = contact.facebook.startsWith('http') ? contact.facebook : `https://${contact.facebook}`;
    lines.push({ key: 'facebook', value: contact.facebook.replace(/^https?:\/\//, ''), href: url });
  }
  const gh = contact?.github || (githubHandle ? `github.com/${githubHandle}` : '');
  if (gh) {
    const url = gh.startsWith('http') ? gh : `https://${gh.replace(/^github.com\//, 'github.com/')}`;
    lines.push({ key: 'github', value: gh.replace(/^https?:\/\//, ''), href: url });
  }
  if (contact?.languages?.length) {
    lines.push({ key: 'languages', value: contact.languages.join(' · ') });
  }

  if (!lines.length) return null;

  if (inline) {
    return (
      <p className="resume-contact-inline resume-body-text text-slate-600">
        {lines.map((line, i) => (
          <span key={line.key}>
            {i > 0 && <span className="mx-1.5 text-slate-400">|</span>}
            {line.href ? (
              <a href={line.href} className="text-slate-700 hover:underline" target="_blank" rel="noopener noreferrer">
                {line.value}
              </a>
            ) : (
              line.value
            )}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {lines.map((line) => (
        <p key={line.key} className="resume-body-text text-slate-700 leading-snug">
          {line.href ? (
            <a href={line.href} className="hover:underline break-all" target="_blank" rel="noopener noreferrer">
              {line.value}
            </a>
          ) : (
            line.value
          )}
        </p>
      ))}
    </div>
  );
}

function ProjectList({
  projects,
  compact = false,
}: {
  projects: CommitCVResume['projects'];
  compact?: boolean;
}) {
  if (!projects?.length) return null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {projects.map((project) => (
        <article key={project.id} className="resume-project">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-1">
            <h4 className="resume-project-title">{project.name}</h4>
            {project.role && (
              <span className="resume-body-text text-slate-500 italic">{project.role}</span>
            )}
          </div>
          {project.url && (
            <p className="resume-body-text text-slate-500 mb-1">
              <a href={project.url} className="hover:underline break-all" target="_blank" rel="noopener noreferrer">
                {project.url.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
          {project.description?.length > 0 && (
            <ul className="resume-body-text list-disc pl-4 space-y-0.5 text-slate-800 mb-1">
              {project.description.map((desc, idx) => (
                <li key={idx}>{desc}</li>
              ))}
            </ul>
          )}
          {project.techStack?.length > 0 && (
            <p className="resume-body-text text-slate-600">
              <span className="font-semibold text-slate-700">Technologies: </span>
              {project.techStack.join(', ')}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function OpenSourceList({ resume, show = false }: { resume: CommitCVResume; show?: boolean }) {
  if (!show || !resume.openSourceContributions?.length) return null;
  return (
    <div>
      {sectionTitle('Open Source')}
      {resume.openSourceSummary && (
        <p className="resume-body-text text-slate-700 mb-2 italic">{resume.openSourceSummary}</p>
      )}
      <ul className="resume-body-text list-disc pl-4 space-y-1 text-slate-800">
        {resume.openSourceContributions.map((c, i) => (
          <li key={i}>
            <span className="font-semibold">{c.project}</span> — {c.role}. {c.highlight}
            {c.prCount > 0 && <span className="text-slate-500"> ({c.prCount} PRs)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatsLine({ resume }: { resume: CommitCVResume }) {
  if (!resume.statistics) return null;
  const { repositoriesCount, commitsCount, pullRequestsCount, issuesCount } = resume.statistics;
  return (
    <p className="resume-body-text text-slate-500 text-[10pt]">
      GitHub activity: {repositoriesCount} repositories · {commitsCount} commits · {pullRequestsCount} pull requests · {issuesCount} issues closed
    </p>
  );
}

function NameHeader({
  resume,
  centered = false,
}: {
  resume: CommitCVResume;
  centered?: boolean;
}) {
  return (
    <header className={centered ? 'text-center' : 'text-left'}>
      <h2 className="resume-name">{resume.name}</h2>
      {resume.title && <p className="resume-title">{resume.title}</p>}
      {resume.slogan && (
        <p className={`resume-body-text text-slate-600 italic mt-1 ${centered ? 'mx-auto max-w-lg' : ''}`}>
          {resume.slogan}
        </p>
      )}
    </header>
  );
}

function ClassicLayout(props: LayoutProps) {
  const { resume, githubHandle, newlyAddedSkills, showOpenSource } = props;
  return (
    <div className="space-y-5">
      <NameHeader resume={resume} />
      <ContactBlock contact={resume.contact} githubHandle={githubHandle} inline />
      {resume.summary && (
        <div>
          {sectionTitle('Summary')}
          <p className="resume-body-text text-slate-800 leading-relaxed">{resume.summary}</p>
        </div>
      )}
      <div>
        {sectionTitle('Technical Skills')}
        <SkillLines skills={resume.skills} newlyAddedSkills={newlyAddedSkills} />
      </div>
      <div>
        {sectionTitle('Projects')}
        <ProjectList projects={resume.projects} />
      </div>
      <OpenSourceList resume={resume} show={showOpenSource} />
      <StatsLine resume={resume} />
    </div>
  );
}

function SidebarLayout(props: LayoutProps) {
  const { resume, githubHandle, newlyAddedSkills, showOpenSource } = props;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,28%)_1fr] gap-6 md:gap-8">
      <aside className="md:border-r md:border-slate-300 md:pr-6 space-y-5">
        <NameHeader resume={resume} />
        <div>
          {sectionTitle('Contact', 'text-[10pt]')}
          <ContactBlock contact={resume.contact} githubHandle={githubHandle} />
        </div>
        <div>
          {sectionTitle('Skills', 'text-[10pt]')}
          <SkillLines skills={resume.skills} newlyAddedSkills={newlyAddedSkills} compact />
        </div>
        <StatsLine resume={resume} />
      </aside>
      <main className="space-y-5 min-w-0">
        {resume.summary && (
          <div>
            {sectionTitle('Professional Summary')}
            <p className="resume-body-text text-slate-800 leading-relaxed">{resume.summary}</p>
          </div>
        )}
        <div>
          {sectionTitle('Experience & Projects')}
          <ProjectList projects={resume.projects} />
        </div>
        <OpenSourceList resume={resume} show={showOpenSource} />
      </main>
    </div>
  );
}

function TwoColumnLayout(props: LayoutProps) {
  const { resume, githubHandle, newlyAddedSkills, showOpenSource } = props;
  return (
    <div className="space-y-5">
      <NameHeader resume={resume} centered />
      <ContactBlock contact={resume.contact} githubHandle={githubHandle} inline />
      {resume.summary && (
        <div className="text-center max-w-3xl mx-auto">
          {sectionTitle('Summary', 'text-center')}
          <p className="resume-body-text text-slate-800 leading-relaxed">{resume.summary}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        <div>
          {sectionTitle('Technical Skills')}
          <SkillLines skills={resume.skills} newlyAddedSkills={newlyAddedSkills} />
          {showOpenSource && (
            <div className="mt-5">
              <OpenSourceList resume={resume} show={showOpenSource} />
            </div>
          )}
        </div>
        <div>
          {sectionTitle('Projects')}
          <ProjectList projects={resume.projects} />
        </div>
      </div>
      <div className="text-center">
        <StatsLine resume={resume} />
      </div>
    </div>
  );
}

function CompactLayout(props: LayoutProps) {
  const { resume, githubHandle, newlyAddedSkills } = props;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-400 pb-2">
        <div>
          <h2 className="resume-name text-[16pt]">{resume.name}</h2>
          <p className="resume-title text-[11pt]">{resume.title}</p>
        </div>
        <ContactBlock contact={resume.contact} githubHandle={githubHandle} inline />
      </div>
      {resume.summary && (
        <p className="resume-body-text text-[10pt] text-slate-800 leading-snug">{resume.summary}</p>
      )}
      <div>
        {sectionTitle('Skills', 'text-[10pt] mb-1')}
        <SkillLines skills={resume.skills} newlyAddedSkills={newlyAddedSkills} compact />
      </div>
      <div>
        {sectionTitle('Projects', 'text-[10pt] mb-1')}
        <ProjectList projects={resume.projects} compact />
      </div>
      <StatsLine resume={resume} />
    </div>
  );
}

function ModernLayout(props: LayoutProps) {
  const { resume, githubHandle, newlyAddedSkills, showOpenSource } = props;
  return (
    <div className="space-y-0">
      <div className="bg-slate-900 text-white px-5 py-5 -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-6 print:bg-white print:text-black print:border-b print:border-slate-400 print:px-0 print:py-4 print:mx-0 print:mt-0">
        <h2 className="text-[22pt] font-semibold tracking-tight leading-none">{resume.name}</h2>
        <p className="text-[12pt] text-slate-300 mt-1 print:text-slate-700">{resume.title}</p>
        <div className="mt-3 text-[10pt] text-slate-300 print:text-slate-600">
          <ContactBlock contact={resume.contact} githubHandle={githubHandle} inline />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-4">
          {resume.summary && (
            <div>
              {sectionTitle('About')}
              <p className="resume-body-text text-slate-800 leading-relaxed">{resume.summary}</p>
            </div>
          )}
          <div>
            {sectionTitle('Skills')}
            <SkillLines skills={resume.skills} newlyAddedSkills={newlyAddedSkills} />
          </div>
        </div>
        <div>
          {sectionTitle('Selected Work')}
          <ProjectList projects={resume.projects} />
          {showOpenSource && (
            <div className="mt-4">
              <OpenSourceList resume={resume} show={showOpenSource} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-200">
        <StatsLine resume={resume} />
      </div>
    </div>
  );
}

interface LayoutProps {
  resume: CommitCVResume;
  githubHandle: string;
  newlyAddedSkills: string[];
  showOpenSource: boolean;
}

const LAYOUTS: Record<ResumeFormatId, (props: LayoutProps) => ReactNode> = {
  classic: ClassicLayout,
  sidebar: SidebarLayout,
  'two-column': TwoColumnLayout,
  compact: CompactLayout,
  modern: ModernLayout,
};

export default function ResumePreview({
  resume,
  formatId = 'classic',
  username,
  newlyAddedSkills = [],
  showOpenSource = false,
}: ResumePreviewProps) {
  const resolved = resolveResumeFormat(formatId);
  const format = getResumeFormatOption(resolved);
  const Layout = LAYOUTS[format.layout];
  const githubHandle = username?.trim().replace(/@/g, '') || '';
  
  // Apply font settings
  const fontSize = resume.fontSize || '11pt';
  const fontFamily = resume.fontFamily || 'Georgia';
  
  const fontFamilyMap: Record<string, string> = {
    'Georgia': 'Georgia, "Times New Roman", Times, serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    'Arial': 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    'Helvetica': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'Calibri': 'Calibri, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  };

  return (
    <div 
      className="resume-document text-slate-900"
      style={{
        fontSize: fontSize,
        fontFamily: fontFamilyMap[fontFamily] || fontFamilyMap['Georgia'],
      }}
    >
      <div className="no-print mb-4 pb-3 border-b border-slate-200">
        <p className="text-[9pt] text-slate-500 uppercase tracking-widest">
          Layout: <span className="text-slate-700 font-semibold normal-case tracking-normal">{format.name}</span>
        </p>
        <p className="text-[9pt] text-slate-400 mt-0.5">{format.description}</p>
      </div>
      <Layout resume={resume} githubHandle={githubHandle} newlyAddedSkills={newlyAddedSkills} showOpenSource={showOpenSource} />
    </div>
  );
}
