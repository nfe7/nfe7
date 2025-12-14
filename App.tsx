import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft,
  ArrowRight,
  Folder,
  Download,
  ExternalLink,
  Code
} from 'lucide-react';
import { fetchUserRepos, fetchRepoContents, fetchRawFile, fetchUserProfile } from './services/githubService';
import RepoCard from './components/RepoCard';
import NotebookRenderer from './components/NotebookRenderer';
import MarkdownRenderer from './components/MarkdownRenderer';
import { GitHubRepo, GitHubFile, JupyterNotebook } from './types';

// --- PERSONAL CONFIGURATION ---
const PERSONAL_INFO = {
  name: "Nick Feng",
  githubUsername: "nfe7",
  email: "nick.feng@example.com", 
  // Profile image is now automatically fetched from GitHub
  social: {
    linkedin: "https://linkedin.com",
    github: "https://github.com/nfe7"
  },
  roles: [
    "Financial Mathematics Graduate",
    "Computer Science Minor",
    "Quantitative Analyst"
  ]
};

// --- HELPER COMPONENTS ---

const Loading = () => (
  <div className="flex justify-center py-20">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
  </div>
);

const ErrorDisplay = ({ message }: { message: string }) => (
  <div className="p-4 bg-red-50 text-red-800 rounded border border-red-100 my-4 text-sm">
    {message}
  </div>
);

// --- MAIN APP COMPONENT ---

function App() {
  const [activeSection, setActiveSection] = useState<'about' | 'projects'>('about');
  const [projectState, setProjectState] = useState<'list' | 'detail' | 'notebook' | 'markdown' | 'pdf'>('list');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [repoFiles, setRepoFiles] = useState<GitHubFile[]>([]);
  const [repoReadme, setRepoReadme] = useState<string | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<JupyterNotebook | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState<string>('');
  const [selectedPdf, setSelectedPdf] = useState<GitHubFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Initialize directly with GitHub avatar shortcut to avoid needing local assets
  const [avatarUrl, setAvatarUrl] = useState<string>(`https://github.com/${PERSONAL_INFO.githubUsername}.png`);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [repoData, profileData] = await Promise.allSettled([
          fetchUserRepos(PERSONAL_INFO.githubUsername),
          fetchUserProfile(PERSONAL_INFO.githubUsername)
        ]);
        if (repoData.status === 'fulfilled') setRepos(repoData.value);
        if (profileData.status === 'fulfilled' && profileData.value.avatar_url) {
          setAvatarUrl(profileData.value.avatar_url);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Sort Repos by Updated Date (Descending)
  const sortedRepos = useMemo(() => {
    // Create a shallow copy to avoid mutating state directly
    return [...repos].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [repos]);

  // Calculate the year of the most recent update across all repos
  const lastUpdatedYear = useMemo(() => {
    if (repos.length === 0) return new Date().getFullYear();
    const latestTimestamp = Math.max(...repos.map(repo => new Date(repo.updated_at).getTime()));
    return new Date(latestTimestamp).getFullYear();
  }, [repos]);

  // Handlers
  const loadRepoContents = async (repo: GitHubRepo, path: string = '') => {
    setLoading(true);
    setError(null);
    setRepoReadme(null);
    try {
      const files = await fetchRepoContents(repo.owner.login, repo.name, path);
      setRepoFiles(files);
      setProjectState('detail');
      setCurrentPath(path);
      const readmeFile = files.find(f => f.name.toLowerCase() === 'readme.md');
      if (readmeFile && readmeFile.download_url) {
        fetchRawFile(readmeFile.download_url).then(text => setRepoReadme(text)).catch(console.warn);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to access repository contents.");
    } finally {
      setLoading(false);
    }
  };

  const handleRepoClick = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setActiveSection('projects');
    loadRepoContents(repo, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileClick = async (file: GitHubFile) => {
    if (file.type === 'dir') {
      loadRepoContents(selectedRepo!, file.path);
      return;
    }
    if (!file.download_url) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedPdf(file);
      setProjectState('pdf');
      return;
    }

    setLoading(true);
    try {
      const raw = await fetchRawFile(file.download_url);
      if (file.name.endsWith('.ipynb')) {
        try {
          const json = JSON.parse(raw);
          setSelectedNotebook(json);
          setProjectState('notebook');
        } catch (e) { setError("Failed to parse notebook."); }
      } else {
        // Markdown or Code
        const content = file.name.endsWith('.md') 
          ? raw 
          : "```" + (file.name.split('.').pop() || '') + "\n" + raw + "\n```";
        setSelectedMarkdown(content);
        setProjectState('markdown');
      }
    } catch (err) {
      setError("Could not download file.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (['notebook', 'markdown', 'pdf'].includes(projectState)) {
      setProjectState('detail');
      setSelectedNotebook(null);
      setSelectedMarkdown('');
      setSelectedPdf(null);
    } else if (projectState === 'detail') {
      if (currentPath) {
        const parentPath = currentPath.split('/').slice(0, -1).join('/');
        loadRepoContents(selectedRepo!, parentPath);
      } else {
        setProjectState('list');
        setSelectedRepo(null);
      }
    }
  };

  // Views
  const renderAbout = () => (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-12 items-start mt-12">
        <div className="w-full md:w-1/3">
           <img 
            src={avatarUrl} 
            alt="Profile" 
            className="w-48 h-48 md:w-56 md:h-56 object-cover rounded shadow-sm border border-gray-200"
          />
           
           <div className="mt-6 text-left">
              <h1 className="text-4xl font-display font-bold text-gray-900">{PERSONAL_INFO.name}</h1>
           </div>

           <div className="mt-6 flex flex-row gap-6 justify-start items-center">
             <a 
               href={`mailto:${PERSONAL_INFO.email}`} 
               className="text-black hover:text-primary transition-colors"
               aria-label="Email"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                  <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                  <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                </svg>
             </a>
             <a 
               href={PERSONAL_INFO.social.github} 
               target="_blank" 
               rel="noreferrer" 
               className="text-black hover:text-primary transition-colors"
               aria-label="Github"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                   <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
             </a>
             <a 
               href={PERSONAL_INFO.social.linkedin} 
               target="_blank" 
               rel="noreferrer" 
               className="text-black hover:text-primary transition-colors"
               aria-label="LinkedIn"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                   <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
             </a>
           </div>

           <div className="mt-8">
             <button
               onClick={() => { setActiveSection('projects'); setProjectState('list'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
               className="group flex items-center justify-center gap-2 px-6 py-3 bg-[#8c1515] text-white font-bold text-sm uppercase tracking-wider rounded shadow-md hover:bg-[#600] hover:shadow-lg transition-all duration-300 w-full md:w-auto"
             >
               View Projects
               <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
             </button>
           </div>
        </div>
        
        <div className="w-full md:w-2/3">
           <h2 className="text-3xl font-display font-bold mb-6 text-gray-800">About Me</h2>
           <div className="prose prose-lg text-gray-600 font-sans leading-relaxed">
             <p className="mb-4">
               I am a graduate in Financial Mathematics with a minor in Computer Science. 
             </p>
             <p className="mb-4">
               I am passionate about building algorithms, analyzing complex datasets, and developing robust software solutions.
               My research interests include Machine Learning and Quantitative Finance.
             </p>
             <p>
               I currently divide my time between independent learning and coaching chess part-time. I am looking for the right opportunity to apply my skills in a challenging, fast-paced setting.
             </p>
           </div>

           <div className="mt-12">
              <h3 className="text-xl font-display font-bold mb-4 text-gray-800">Interests</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 pl-2">
                <li>Quantitative Analysis</li>
                <li>Machine Learning & Deep Learning</li>
                <li>Data Science</li>
              </ul>

           </div>
                      <div className="mt-12">
              <h3 className="text-xl font-display font-bold mb-4 text-gray-800">Hobbies</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 pl-2">
                <li>Chess</li>
                <li>Running</li>
                <li>Investing</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );

  const renderProjects = () => {
    if (projectState === 'list') {
      return (
        <div className="mt-12 animate-in fade-in duration-500">
           <h1 className="text-3xl font-display font-bold mb-2 text-gray-800">Projects & Repositories</h1>
           <p className="text-lg text-gray-600 mb-8 font-sans">
             <a href={PERSONAL_INFO.social.github} target="_blank" rel="noreferrer" className="text-primary hover:text-red-800 border-b border-dotted border-primary">
               (Github Profile)
             </a>
           </p>
           <hr className="border-gray-200 mb-12" />

           {loading ? <Loading /> : (
             <div className="space-y-12">
               {sortedRepos.map(repo => (
                 <RepoCard key={repo.id} repo={repo} onClick={handleRepoClick} />
               ))}
             </div>
           )}
        </div>
      );
    }

    // Detail View (File Browser or Content Viewer)
    return (
      <div className="mt-8 animate-in fade-in duration-500 min-h-screen">
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to {projectState === 'detail' ? 'Projects' : 'Folder'}</span>
        </button>

        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 mb-12">
           <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
              <Folder className="text-primary" size={24} />
              <div>
                <h2 className="text-xl font-display font-bold text-gray-800">{selectedRepo?.name}</h2>
                <p className="text-sm text-gray-500 font-mono">/{currentPath}</p>
              </div>
              {selectedRepo?.html_url && (
                <a href={selectedRepo.html_url} target="_blank" rel="noreferrer" className="ml-auto text-gray-400 hover:text-primary">
                  <ExternalLink size={20} />
                </a>
              )}
           </div>

           {loading ? <Loading /> : error ? <ErrorDisplay message={error} /> : (
             <>
               {projectState === 'detail' && (
                 <div>
                    <div className="grid grid-cols-12 gap-4 border-b border-gray-200 pb-2 mb-2 text-xs font-bold text-gray-500 uppercase">
                      <div className="col-span-8">Name</div>
                      <div className="col-span-4 text-right">Size</div>
                    </div>
                    {repoFiles.map(file => (
                      <div 
                        key={file.path}
                        onClick={() => handleFileClick(file)}
                        className="grid grid-cols-12 gap-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 items-center group"
                      >
                        <div className="col-span-8 flex items-center gap-3">
                           {file.type === 'dir' ? <Folder size={16} className="text-blue-400" /> : <Code size={16} className="text-gray-400" />}
                           <span className="text-sm text-gray-700 font-medium group-hover:text-primary transition-colors">{file.name}</span>
                        </div>
                        <div className="col-span-4 text-right text-xs text-gray-400 font-mono">
                          {file.size ? (file.size/1024).toFixed(1) + ' KB' : '-'}
                        </div>
                      </div>
                    ))}
                    
                    {repoReadme && (
                      <div className="mt-8 pt-8 border-t border-gray-200">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                           <Code size={20} /> README
                        </h3>
                        <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-6 rounded border border-gray-100">
                          <MarkdownRenderer content={repoReadme} />
                        </div>
                      </div>
                    )}
                 </div>
               )}

               {projectState === 'notebook' && selectedNotebook && (
                 <div className="overflow-x-auto">
                    <NotebookRenderer notebook={selectedNotebook} />
                 </div>
               )}

               {projectState === 'markdown' && selectedMarkdown && (
                 <div className="prose prose-slate max-w-none">
                    <MarkdownRenderer content={selectedMarkdown} />
                 </div>
               )}

               {projectState === 'pdf' && selectedPdf && (
                 <div className="text-center py-12">
                    <p className="mb-4 text-gray-600">This file is a PDF document.</p>
                    <a 
                      href={selectedPdf.download_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded hover:bg-red-800 transition-colors"
                    >
                      <Download size={16} /> Open PDF
                    </a>
                 </div>
               )}
             </>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans border-t-4 border-primary box-border">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 opacity-95">
        <div className="max-w-5xl mx-auto px-6 h-20 flex flex-col md:flex-row items-center justify-between">
           <div className="text-2xl font-display font-bold tracking-tight">
             <a href="#" onClick={(e) => { e.preventDefault(); setActiveSection('about'); setProjectState('list'); }} className="hover:text-primary transition-colors">
               {PERSONAL_INFO.name}
             </a>
           </div>
           
           <nav className="flex items-center space-x-8 text-sm font-semibold uppercase tracking-wide text-gray-500 mt-4 md:mt-0">
              <button 
                onClick={() => { setActiveSection('about'); setProjectState('list'); }}
                className={`${activeSection === 'about' ? 'text-primary' : 'hover:text-primary'} transition-colors`}
              >
                About
              </button>
              <button 
                 onClick={() => { setActiveSection('projects'); setProjectState('list'); }}
                 className={`${activeSection === 'projects' ? 'text-primary' : 'hover:text-primary'} transition-colors`}
              >
                Projects
              </button>
           </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 pb-24">
        {activeSection === 'about' && renderAbout()}
        {activeSection === 'projects' && renderProjects()}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400 font-mono">
         &copy; {lastUpdatedYear} {PERSONAL_INFO.name}. Powered by Gemini.
      </footer>
    </div>
  );
}

export default App;