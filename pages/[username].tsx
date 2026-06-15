import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Github, AlertCircle, Lock, Eye, ExternalLink, CheckCircle, RefreshCw, Sparkles, LayoutTemplate, FileText } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase';
import { CommitCVResume } from '../src/types';
import ResumePreview from '../src/components/ResumePreview';
import { getResumeFormatOption, resolveResumeFormat } from '../src/resumeFormats';

export default function UsernamePage() {
  const router = useRouter();
  const { username } = router.query;
  const [loading, setLoading] = useState(true);
  const [resume, setResume] = useState<CommitCVResume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrivateGuide, setShowPrivateGuide] = useState(false);

  useEffect(() => {
    if (!username || typeof username !== 'string') return;

    const loadResume = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const cleanUsername = username.trim().replace(/@/g, '').toLowerCase();
        
        // Try loading from Firestore first
        const docRef = doc(db, 'resumes', cleanUsername);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const loadedResume = docSnap.data() as CommitCVResume;
          setResume(loadedResume);
        } else {
          // If not in Firestore, try fetching from API
          const response = await fetch('/api/github/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: null,
              username: cleanUsername
            })
          });
          
          const data = await response.json();
          
          if (response.ok && data.resume) {
            setResume(data.resume);
          } else if (response.status === 403 || data.error?.includes('private') || data.error?.includes('403')) {
            setError('private');
            setShowPrivateGuide(true);
          } else {
            setError(data.error || 'Failed to load resume');
          }
        }
      } catch (err: any) {
        console.error('Error loading resume:', err);
        setError(err.message || 'Failed to load resume');
      } finally {
        setLoading(false);
      }
    };

    loadResume();
  }, [username]);

  const handleRetry = () => {
    if (username && typeof username === 'string') {
      setLoading(true);
      setError(null);
      router.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden">
        {/* Decorative backdrop grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
        
        <div className="text-center relative z-10">
          <RefreshCw className="w-12 h-12 text-brand-cyan animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-mono text-sm">Loading @{username}'s resume...</p>
        </div>
      </div>
    );
  }

  if (error === 'private') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
        {/* Decorative backdrop grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
        
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 py-3 relative z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="CommitCV Logo" className="h-9 w-auto object-contain rounded-lg shadow-md" />
              <span className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-cyan bg-clip-text text-transparent">CommitCV</span>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-brand-cyan hover:text-white transition font-mono"
            >
              ← Back to Home
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-16 relative z-10">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-display font-bold text-white mb-2">GitHub Profile is Private</h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The GitHub profile for <span className="text-brand-cyan font-mono">@{username}</span> is currently set to private. It needs to be public to generate a resume.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-purple" />
                How to Make Your GitHub Profile Public
              </h2>
              
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-brand-purple/20 text-brand-purple rounded-full flex items-center justify-center text-sm font-bold font-mono">1</span>
                  <div className="flex-1">
                    <p className="text-slate-300 mb-2 font-sans">Sign in to your GitHub account</p>
                    <a 
                      href="https://github.com/settings/profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-brand-cyan hover:text-white transition text-sm font-mono"
                    >
                      Open GitHub Profile Settings
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-brand-purple/20 text-brand-purple rounded-full flex items-center justify-center text-sm font-bold font-mono">2</span>
                  <div className="flex-1">
                    <p className="text-slate-300 mb-2 font-sans">Scroll down to the "Public profile" section</p>
                    <p className="text-slate-500 text-sm font-mono">Located in your profile settings page</p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-brand-purple/20 text-brand-purple rounded-full flex items-center justify-center text-sm font-bold font-mono">3</span>
                  <div className="flex-1">
                    <p className="text-slate-300 mb-2 font-sans">Ensure your profile visibility is set to public</p>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 mt-2">
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-slate-300 font-medium font-mono">Uncheck "Make profile private and hide activity"</p>
                          <p className="text-slate-500 text-xs mt-1 font-sans">This will make your contributions graph and activity visible to everyone</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-brand-purple/20 text-brand-purple rounded-full flex items-center justify-center text-sm font-bold font-mono">4</span>
                  <div className="flex-1">
                    <p className="text-slate-300 mb-2 font-sans">Save changes and return to this page</p>
                    <button
                      onClick={handleRetry}
                      className="mt-2 inline-flex items-center gap-2 bg-brand-purple hover:bg-brand-purple/80 text-white px-4 py-2 rounded-lg transition text-sm font-mono font-semibold"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Loading Resume
                    </button>
                  </div>
                </li>
              </ol>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm font-sans">
                  <p className="text-blue-300 font-semibold mb-1">Why do we need a public profile?</p>
                  <p className="text-blue-200/80 leading-relaxed">
                    CommitCV generates resumes by analyzing your public GitHub activity, commit history, and repositories.
                    A private profile prevents us from accessing this information. You can always set your profile back to private later.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-slate-500 text-sm text-center font-mono">
                Need help?{' '}
                <a href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/about-your-profile" target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:text-white transition">
                  View GitHub Profile Documentation
                </a>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden">
        {/* Decorative backdrop grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
        
        <div className="bg-slate-900/80 backdrop-blur-sm border border-red-900/50 rounded-xl p-8 max-w-md text-center relative z-10 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-display font-bold text-white mb-2">Failed to Load Resume</h2>
          
          {/* Check if error message indicates timeout or rate limit */}
          {error.includes('timeout') || error.includes('timed out') || error.includes('rate limit') || error.includes('free model') ? (
            <>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                <p className="text-amber-300 font-mono text-sm mb-2">⏱️ Request Timeout</p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Due to free model limits, the analysis timed out. This is temporary - please try again in a moment.
                </p>
              </div>
              <p className="text-slate-400 font-mono text-xs mb-4">{error}</p>
            </>
          ) : (
            <p className="text-slate-400 mb-4 font-mono text-sm">{error}</p>
          )}
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="bg-brand-purple hover:bg-brand-purple/80 text-white px-4 py-2 rounded-lg transition font-mono text-sm font-semibold"
            >
              Retry
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition font-mono text-sm"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden">
        {/* Decorative backdrop grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
        
        <div className="text-center relative z-10">
          <Github className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-mono mb-2">Resume not found for @{username}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-brand-cyan hover:text-white transition font-mono text-sm"
          >
            ← Create Resume on CommitCV
          </button>
        </div>
      </div>
    );
  }

  // Display resume
  const activeFormat = resolveResumeFormat(resume.resumeFormat);
  const formatMeta = getResumeFormatOption(activeFormat);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden selection:bg-brand-purple/30 selection:text-white">
      {/* Decorative backdrop grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 py-3 relative z-10 sticky top-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CommitCV Logo" className="h-9 w-auto object-contain rounded-lg shadow-md" />
            <div>
              <span className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-cyan bg-clip-text text-transparent">CommitCV</span>
              <p className="text-[10px] text-slate-400 font-mono hidden md:block">"Every commit builds your career."</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-xs font-mono text-brand-cyan hover:text-white bg-slate-800 hover:bg-slate-700 transition px-3.5 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Create Your Resume
            </button>
          </div>
        </div>
      </header>

      {/* Resume Display */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm"  >
          
          {/* Doc header bar */}
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/90">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-purple" />
              <span className="font-display font-bold text-xs text-white uppercase tracking-wider">Live Resume Portfolio</span>
              <div className="h-4 w-px bg-slate-800" />
              <span className="text-xs text-slate-400 font-mono">
                @{username}
              </span>
            </div>

            <a
              href={`https://github.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition text-xs font-mono"
            >
              <Github className="w-3.5 h-3.5" />
              <span>View on GitHub</span>
            </a>
          </div>

          {/* Actions strip */}
          <div className="px-5 py-2.5 bg-slate-800/30 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">⚡ Powered by live analyzed GitHub profile information</span>
            <span className="flex items-center gap-1.5 font-mono text-brand-cyan">
              <LayoutTemplate className="w-3.5 h-3.5" />
              {formatMeta.name}
            </span>
          </div>

          {/* Resume Body */}
          <div className="p-6 md:p-8 bg-white text-slate-900">
            <ResumePreview
              resume={resume}
              formatId={activeFormat}
              username={typeof username === 'string' ? username : undefined}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
