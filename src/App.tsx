/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Github, 
  GitBranch, 
  Terminal, 
  Send, 
  Sparkles, 
  RefreshCw, 
  Download, 
  Check, 
  Code, 
  Database, 
  Cpu, 
  AlertCircle, 
  GitCommit,
  GitPullRequest,
  Clipboard,
  FileText,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { CommitCVResume, ChatMessage } from './types';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import AICareerCoach from './components/AICareerCoach';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [githubToken, setGithubToken] = useState<string>('');
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resume, setResume] = useState<CommitCVResume | null>(null);
  
  const [currentView, setCurrentView] = useState<'cv' | 'coach'>('cv');
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  
  // Chat Co-pilot state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  
  // Highlighting new skills from user interaction modifications
  const [newlyAddedSkills, setNewlyAddedSkills] = useState<string[]>([]);
  const [clipboardCopied, setClipboardCopied] = useState<boolean>(false);
  const [showPushNotification, setShowPushNotification] = useState<boolean>(false);
  const [pushNotificationDetails, setPushNotificationDetails] = useState<{
    repository: string;
    commitMessage: string;
    timestamp: string;
    addedSkills: string[];
  } | null>(null);
  const [customCommitMessage, setCustomCommitMessage] = useState<string>('feat: add Redis cache, Dockerize application, design REST APIs');
  const [simulating, setSimulating] = useState<boolean>(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState<boolean>(false);
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState<boolean>(false);
  const [copiedHomepageUrl, setCopiedHomepageUrl] = useState<boolean>(false);

  // Auto scroll chat to bottom
  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Handle incoming postMessages/storage synchronizations from GitHub OAuth Window popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.token;
        setGithubToken(token);
        setIsAuthenticated(true);
        triggerAnalysis(token, null);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'github_oauth_token' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed.token) {
            setGithubToken(parsed.token);
            setIsAuthenticated(true);
            triggerAnalysis(parsed.token, null);
            // Clear once retrieved to prevent re-triggering
            localStorage.removeItem('github_oauth_token');
          }
        } catch (e) {
          console.error('Error parsing token from storage:', e);
        }
      }
    };

    // Callback fallback scanner (for checking if token is written to same-origin localStorage already)
    const checkLocalStorageToken = () => {
      const stored = localStorage.getItem('github_oauth_token');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.token) {
            setGithubToken(parsed.token);
            setIsAuthenticated(true);
            triggerAnalysis(parsed.token, null);
            localStorage.removeItem('github_oauth_token');
          }
        } catch (e) {
          console.error('Error parsing token from direct check:', e);
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    window.addEventListener('storage', handleStorageChange);

    // Run custom high-frequency checker for instant OAuth feedback inside sandbox frames
    const checkInterval = setInterval(checkLocalStorageToken, 1000);

    // Initial check on mounting/refreshing
    checkLocalStorageToken();

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  // Real-time listener for Firestore push updates
  useEffect(() => {
    if (!githubUsername) return;
    
    const cleanUsernameLower = githubUsername.trim().replace(/@/g, '').toLowerCase();
    const docRef = doc(db, 'resumes', cleanUsernameLower);
    
    console.log(`Setting up real-time listener for document: resumes/${cleanUsernameLower}`);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const updatedResume = docSnap.data() as CommitCVResume;
        
        // Detect if has a newer push record we haven't seen in this session
        if (updatedResume.latestPush) {
          const pushDetails = updatedResume.latestPush;
          
          setPushNotificationDetails(prev => {
            // Compare timestamps to make sure we don't display old notifications on load
            if (!prev || prev.timestamp !== pushDetails.timestamp) {
              // Trigger a beautiful visual alert!
              setShowPushNotification(true);
              
              if (pushDetails.addedSkills && pushDetails.addedSkills.length > 0) {
                setNewlyAddedSkills(pushDetails.addedSkills);
                
                // Add system message to Chat Co-pilot
                setMessages(prevMsgs => [
                  ...prevMsgs,
                  {
                    id: `push-${Date.now()}`,
                    sender: 'assistant',
                    text: `⚡ **GitHub App Push Webhook Active!**\n\n🔹 **Repo**: _${pushDetails.repository}_\n🔹 **Commit**: "${pushDetails.commitMessage}"\n\n✨ **Skills Discovered & Added:**\n${pushDetails.addedSkills.map(s => `• **${s}**`).join('\n')}\n\n*Your Live CV has been dynamically updated in real-time!*`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
              }
            }
            return pushDetails;
          });
        }
        
        setResume(updatedResume);
      }
    }, (error) => {
      console.error("Firestore live listener failed:", error);
    });
    
    return () => unsubscribe();
  }, [githubUsername]);

  // Set up real GitHub OAuth Login Flow
  const handleGithubConnect = async () => {
    setErrorBanner(null);
    try {
      setLoading(true);
      const res = await fetch('/api/auth/github/url');
      const data = await res.json();
      if (data.url) {
        // Open authorization popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const win = window.open(
          data.url,
          'Connect with GitHub',
          `width=${width},height=${height},top=${top},left=${left},status=none,toolbar=none,menubar=none`
        );
        if (!win) {
          setErrorBanner("Popup blocked! Your browser blocked the GitHub Sign-In Popup because it is running inside an iframe. Please allow popups for this page, or open the app in a new tab via the 'Development App URL' link at the top!");
        }
      } else {
        setErrorBanner(data.error || 'GitHub OAuth variables not configured. Please use the "Public Username Scan" on the left, or add GITHUB_CLIENT_ID to your secrets!');
      }
    } catch (err) {
      console.error(err);
      setErrorBanner('Failed to initialize OAuth. Please use the "Public Username Scan" instead, or check the developer console.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Resume analyzer from server-side using Gemini 3.5 Flash, checking Firestore first (unless forceReload is active)
  const triggerAnalysis = async (token: string | null, username: string | null, forceReload: boolean = false) => {
    setLoading(true);
    setNewlyAddedSkills([]);
    
    const targetUsername = username ? username.trim().replace(/@/g, '') : '';
    const cleanUsernameLower = targetUsername.toLowerCase();

    // Check Firestore first
    if (!forceReload && cleanUsernameLower) {
      try {
        const docRef = doc(db, 'resumes', cleanUsernameLower);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const loadedResume = docSnap.data() as CommitCVResume;
          setResume(loadedResume);
          setGithubUsername(targetUsername);
          setMessages([
            {
              id: 'system-init',
              sender: 'assistant',
              text: `📂 Saved Resume for **${loadedResume.name}** loaded from Firebase Firestore! If you want to pull fresh live Git commits, click the "Re-sync Live Git" button above.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Failed to retrieve cached profile from Firebase Firestore, pulling from live API:", err);
      }
    }

    try {
      const response = await fetch('/api/github/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          username: targetUsername || null
        })
      });
      const data = await response.json();
      if (response.ok && data.resume) {
        setResume(data.resume);
        
        // Persist to Firestore as the master record
        const finalUsername = (targetUsername || data.username || data.resume.name).trim().replace(/@/g, '');
        if (finalUsername) {
          setGithubUsername(finalUsername);
          try {
            await setDoc(doc(db, 'resumes', finalUsername.toLowerCase()), data.resume);
          } catch (firebaseErr: any) {
            console.error("Failed to sync resume to Firebase Firestore:", firebaseErr);
          }
        }

        setMessages([
          {
            id: 'system-init',
            sender: 'assistant',
            text: `✨ Resume generated successfully! Raw commits and repositories translated into a dynamic profile for **${data.resume.name}** and securely saved in Firebase Firestore. What would you like to edit next?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error(data.error || 'Failed to complete resume analysis.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorBanner(err.message || 'Analysis failed. Make sure the username has active repositories, and check if your OpenRouter credentials are fully set up!');
    } finally {
      setLoading(false);
    }
  };

  // Chat with AI to apply edits dynamically
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim() || !resume) return;

    if (!textToSend) {
      setInputValue('');
    }

    const newUserMessage: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/resume/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentResume: resume,
          message: query,
          history: messages.map(m => ({ role: m.sender, parts: [{ text: m.text }] }))
        })
      });

      const data = await response.json();
      if (response.ok && data.updatedResume) {
        setResume(data.updatedResume);

        // Persist the updated resume state to Firestore
        const finalUsername = (githubUsername || data.updatedResume.name).trim().replace(/@/g, '');
        if (finalUsername) {
          try {
            await setDoc(doc(db, 'resumes', finalUsername.toLowerCase()), data.updatedResume);
          } catch (firebaseErr: any) {
            console.error("Failed to sync edited updates to Firebase Firestore:", firebaseErr);
          }
        }

        setMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'assistant',
            text: data.chatResponse || "Resume updated to reflect changes successfully.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        
        // Scan query for added technologies to sparkle them visually on screen
        const words = query.toLowerCase().split(/\s+/);
        const highlighted = ['docker', 'redis', 'kubernetes', 'golang', 'rust', 'aws', 'python', 'next.js', 'typescript'];
        const matches = highlighted.filter(h => words.includes(h) || query.toLowerCase().includes(h));
        if (matches.length > 0) {
          // Capitalize accurately
          const formatted = matches.map(m => m === 'next.js' ? 'Next.js' : m.charAt(0).toUpperCase() + m.slice(1));
          setNewlyAddedSkills(prev => Array.from(new Set([...prev, ...formatted])));
        }
      } else {
        throw new Error(data.error || 'Chat copilot could not edit target fields.');
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `Error updating the resume structure: ${err.message || 'API query error'}. Let's re-try another request.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!resume) return;
    navigator.clipboard.writeText(JSON.stringify(resume, null, 2));
    setClipboardCopied(true);
    setTimeout(() => setClipboardCopied(false), 2000);
  };

  const triggerPrint = () => {
    window.print();
  };

  const handleReset = () => {
    setResume(null);
    setNewlyAddedSkills([]);
    setGithubUsername('');
  };

  const handleSimulatePush = async (customMessage?: string) => {
    if (!resume) return;
    setSimulating(true);
    setErrorBanner(null);
    try {
      const targetUser = githubUsername || resume.name;
      const msg = customMessage || customCommitMessage || 'feat: add Redis cache, Dockerize application, design REST APIs';
      
      const response = await fetch(`/api/webhook/github?username=${encodeURIComponent(targetUser)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: { name: 'CommitCV-Core' },
          commits: [
            {
              id: `sha-${Math.random().toString(36).substring(2, 10)}`,
              message: msg,
              author: { name: targetUser, username: targetUser }
            }
          ]
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Push event was declined during webhook validation.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorBanner(err.message || 'Webhook push simulation failed. Inspect dev logs.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-purple/30 selection:text-white relative overflow-hidden">
      
      {/* Decorative clean backdrop grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md relative z-10 sticky top-0 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-purple to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-purple/20">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-cyan bg-clip-text text-transparent">CommitCV</span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden md:block">"Every commit builds your career."</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {resume && (
              <>
                <button
                  onClick={() => triggerAnalysis(null, githubUsername || resume.name, true)}
                  disabled={loading}
                  className="text-xs font-mono text-brand-cyan hover:text-white bg-slate-800 hover:bg-slate-700 transition px-3.5 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Re-sync Live Git
                </button>
                <button
                  onClick={handleReset}
                  className="text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition px-3.5 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-1.5"
                >
                  Analyze New Profile
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8 relative z-10 flex flex-col justify-center">
        
        {errorBanner && (
          <div className="mx-auto w-full max-w-2xl mb-6 bg-slate-900 border border-red-900/50 text-slate-100 p-4 rounded-xl flex items-start gap-3 relative shadow-xl shadow-red-950/25">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 text-xs md:text-sm">
              <p className="font-display font-semibold text-red-400 mb-1">Authenticating/Scanning Notice</p>
              <p className="text-slate-300 leading-relaxed font-mono">{errorBanner}</p>
              <div className="mt-2 text-xs text-slate-400 font-sans border-t border-slate-800 pt-2 flex flex-col gap-1">
                <span>💡 <strong>Config Tip</strong>: Setup <code>OPENROUTER_API_KEY</code> and <code>GITHUB_CLIENT_ID</code> inside security secrets in real hosting context.</span>
                <span>💡 <strong>IFrame Tip</strong>: If browser blocks popups inside this sandbox iframe, click the <strong>Development App URL</strong> at the top to open this app directly in a full browser tab!</span>
              </div>
            </div>
            <button 
              onClick={() => setErrorBanner(null)}
              className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition shrink-0 self-start"
            >
              ✕
            </button>
          </div>
        )}

        {!resume ? (
          /* Main Functional Onboarding Workspace */
          <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto py-12 md:py-16 text-center relative">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-purple/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-brand-cyan/10 rounded-full blur-3xl -z-10" />

            <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1 bg-opacity-80 rounded-full text-xs font-mono text-slate-300 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
              Living developer CVs crafted with Gemini
            </div>

            <h1 className="font-display font-bold text-4xl md:text-5xl text-white tracking-tight leading-tight mb-4 max-w-2xl">
              Turn Your Live Git Work Into a <span className="bg-gradient-to-r from-brand-purple to-brand-cyan bg-clip-text text-transparent">Pristine Resume</span>
            </h1>

            <p className="text-slate-400 text-sm md:text-base mb-10 max-w-xl leading-relaxed">
              Scan any public GitHub account instantly, or authenticate via OAuth to pull your personal code history. Our AI analyzes your repositories, technologies, and active commits to generate an industry-grade resume in seconds.
            </p>

            {/* Core Integrations - 100% Real, Clean Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl text-left mb-10">
              
              {/* Public GitHub Username Access */}
              <div className="bg-slate-900/80 border border-slate-800 hover:border-brand-cyan/40 transition rounded-xl p-6 flex flex-col justify-between relative group">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-brand-cyan">
                      <Code className="w-5 h-5" />
                    </div>
                    <span className="font-display font-semibold text-white">Public Username Scan</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Enter any valid GitHub username (e.g. <code>gaearon</code>, <code>torvalds</code>, or your own profile). No login or token setup required.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && githubUsername.trim() && triggerAnalysis(null, githubUsername)}
                    placeholder="Enter GitHub username (e.g. gaearon)"
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 p-2.5 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-cyan transition"
                  />
                  <button
                    onClick={() => triggerAnalysis(null, githubUsername)}
                    disabled={loading || !githubUsername.trim()}
                    className="w-full bg-brand-cyan hover:bg-cyan-500 text-slate-950 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        Analyze Public Profile
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Secure GitHub App & OAuth Connection */}
              <div className="bg-slate-900/80 border border-slate-800 hover:border-brand-purple/40 transition rounded-xl p-6 flex flex-col justify-between relative group md:col-span-1">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-brand-purple">
                        <Github className="w-5 h-5" />
                      </div>
                      <span className="font-display font-semibold text-white">Developer OAuth Sign-in</span>
                    </div>
                    <span className="text-[10px] bg-slate-950 text-brand-purple font-mono border border-slate-800 px-2 py-0.5 rounded">App Config</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Securely authorize CommitCV to read your personal and private repository contributions list to build an integrated view.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={handleGithubConnect}
                    disabled={loading}
                    className="w-full bg-slate-100 hover:bg-white text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Github className="w-4 h-4" />
                        Sign in with GitHub
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowSetupGuide(!showSetupGuide)}
                    className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-[10px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>{showSetupGuide ? '隐藏' : '显示'} GitHub App 回调与 Webhook 配置</span>
                  </button>
                </div>

                {showSetupGuide && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-3.5 text-left text-xs text-slate-300 animate-fadeIn">
                    <h4 className="font-display font-bold text-slate-200 text-xs">🛠️ Developer Credentials Guide</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Go to GitHub <strong className="text-white">Developer settings</strong> (OAuth App or GitHub App), and configure these required integration properties:
                    </p>

                    {/* Homepage URL */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                        <span>Homepage URL</span>
                        <span>Copy</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <div className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-300 truncate">
                          {window.location.origin}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin);
                            setCopiedHomepageUrl(true);
                            setTimeout(() => setCopiedHomepageUrl(false), 2000);
                          }}
                          className="bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-1.5 rounded text-[10px] font-sans transition shrink-0 cursor-pointer border border-slate-800"
                        >
                          {copiedHomepageUrl ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Authorization Callback URL */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                        <span>User authorization callback URL</span>
                        <span className="text-brand-purple font-semibold animate-pulse">Required for Sign-In</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <div className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-300 truncate">
                          {window.location.origin}/api/auth/github/callback
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/auth/github/callback`);
                            setCopiedCallbackUrl(true);
                            setTimeout(() => setCopiedCallbackUrl(false), 2000);
                          }}
                          className="bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-1.5 rounded text-[10px] font-sans transition shrink-0 cursor-pointer border border-slate-800"
                        >
                          {copiedCallbackUrl ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Webhook URL */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                        <span>Webhook URL (for Real-time Push)</span>
                        <span>Active</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <div className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-300 truncate">
                          {window.location.origin}/api/webhook/github
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhook/github`);
                            setCopiedWebhookUrl(true);
                            setTimeout(() => setCopiedWebhookUrl(false), 2000);
                          }}
                          className="bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-1.5 rounded text-[10px] font-sans transition shrink-0 cursor-pointer border border-slate-800"
                        >
                          {copiedWebhookUrl ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded border border-slate-850 text-[10px] text-slate-400 space-y-1 font-sans">
                      <p>💡 <strong>Credentials Secret Settings</strong>: Update your applet's Secrets with <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> to authorize live tokens.</p>
                      <p className="pt-1">💡 <strong>Push Event Permissions</strong>: Turn on Webhooks in GitHub App settings, check <strong className="text-slate-300">Push events</strong> subscribe, and select <strong className="text-slate-300">application/json</strong> Content type.</p>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Clean, humble security footprint */}
            <div className="flex items-start gap-2 max-w-md mx-auto text-xs text-slate-500 bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 text-left">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Policy:</strong> GITHUB_CLIENT keys are sent securely. We parse activity data in volatile server memory without databases tracking.
              </span>
            </div>

          </div>
        ) : (
          /* Step 2, 3, 4: Main Resume workspace */
          <div className="flex flex-col gap-6 flex-1">
            
            {/* Beautiful Navigation Tabs inside Dashboard Workspace */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-850 self-start">
                <button
                  onClick={() => setCurrentView('cv')}
                  className={`flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-lg transition-all duration-150 cursor-pointer ${
                    currentView === 'cv'
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-brand-purple" />
                  <span>Resume Portfolio Co-pilot</span>
                </button>
                <button
                  onClick={() => setCurrentView('coach')}
                  className={`flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-lg transition-all duration-150 relative cursor-pointer ${
                    currentView === 'coach'
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Career Coach</span>
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <span>Active Profile Context: <strong className="text-slate-300">@{githubUsername || (resume && resume.name) || "scanned_developer"}</strong></span>
              </div>
            </div>

            {currentView === 'coach' ? (
              <AICareerCoach currentResume={resume} username={githubUsername || (resume && resume.name) || "scanned_username"} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
            
            {/* LEFT COLUMN: CHAT COPILOT ONLY (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
              
              {/* Resume Chat Copilot - Pristine layout taking full height */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex-1 flex flex-col relative overflow-hidden min-h-[450px]">
                
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-purple animate-pulse" />
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">AI Resume Chat Co-pilot</h3>
                      <p className="text-[10px] text-slate-400">Instruct Gemini to adjust your CV instantly</p>
                    </div>
                  </div>
                  <span className="bg-slate-950 text-slate-400 font-mono text-[10px] px-2.5 py-0.5 rounded border border-slate-800">
                    Online
                  </span>
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px] mb-4 text-left">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-brand-purple/20 text-indigo-100 border border-brand-purple/30 self-end ml-auto'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 self-start'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <span className="text-[9px] text-slate-500 font-mono mt-1.5 self-end block">
                        {m.timestamp}
                      </span>
                    </div>
                  ))}
                  
                  {isChatLoading && (
                    <div className="bg-slate-950 text-slate-400 border border-slate-800 rounded-2xl p-3.5 text-xs self-start max-w-[85%] flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-purple" />
                      <span>Applying structured edits to resume fields...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Predefined prompt controls */}
                <div className="mb-4">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2 text-left">Quick tuning actions</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleSendMessage("Include Docker, Kubernetes, and Cloud Deployments to my tools list")}
                      className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1 px-3 rounded-lg text-slate-300 transition text-left"
                    >
                      + Add DevOps Stack
                    </button>
                    <button
                      onClick={() => handleSendMessage("Optimize my summary and titles specifically for a Senior Backend Engineering role")}
                      className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1 px-3 rounded-lg text-slate-300 transition text-left"
                    >
                      ✍️ Target Senior Backend
                    </button>
                    <button
                      onClick={() => handleSendMessage("Highlight my open-source contribution and impact stats inside the CV layout")}
                      className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1 px-3 rounded-lg text-slate-300 transition text-left"
                    >
                      ⭐ Focus Open Source
                    </button>
                  </div>
                </div>

                {/* Input form */}
                <div className="flex items-center gap-2 mt-auto">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask Gemini to add skills or rewrite descriptions..."
                    className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs py-2.5 px-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-purple transition"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isChatLoading || !inputValue.trim()}
                    className="bg-brand-purple hover:bg-purple-600 disabled:opacity-50 text-white rounded-xl p-2.5 transition shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* GitHub Webhook Push Simulator - Elite Developer Panel */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mt-4 flex flex-col relative text-left">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h3 className="font-display font-bold text-xs uppercase text-slate-100 tracking-wider">GitHub App Webhook Simulator</h3>
                    <p className="text-[10px] text-slate-400">Simulate or configure real Git push triggers</p>
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    <strong>Auto Update on Push</strong>: Each time you perform a <code>git push</code>, our integration parses new technologies and upgrades your resume in real-time.
                  </p>
                  
                  {/* Real Webhook Config Tip */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono select-all relative group flex items-center justify-between gap-1.5 gap-y-1">
                    <div className="overflow-x-auto truncate mr-1">
                      <span className="text-slate-500">HOOK:</span> {window.location.origin}/api/webhook/github?username={githubUsername || resume?.name || 'demo'}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhook/github?username=${githubUsername || resume?.name || 'demo'}`);
                        setCopiedWebhookUrl(true);
                        setTimeout(() => setCopiedWebhookUrl(false), 2000);
                      }}
                      className="text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-700 font-sans transition py-1 px-2 rounded shrink-0 cursor-pointer"
                    >
                      {copiedWebhookUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Git Push Simulator Form */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Commit Message Payload</label>
                    <input
                      type="text"
                      value={customCommitMessage}
                      onChange={(e) => setCustomCommitMessage(e.target.value)}
                      placeholder="e.g. feat: add Redis cache, Dockerize application, design REST APIs"
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-xs py-2 px-3 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500 transition font-mono"
                    />
                  </div>

                  {/* Preset Quick Actions */}
                  <div>
                    <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Demo Quick Presets:</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          setCustomCommitMessage("feat: add Redis cache, Dockerize application, design REST APIs");
                          handleSimulatePush("feat: add Redis cache, Dockerize application, design REST APIs");
                        }}
                        disabled={simulating}
                        className="text-[10px] bg-slate-950 hover:bg-emerald-950/20 border border-slate-800 hover:border-emerald-500/30 text-slate-300 py-1.5 px-2 rounded-lg text-left transition truncate cursor-pointer"
                      >
                        🔮 Redis & Docker Stack
                      </button>
                      <button
                        onClick={() => {
                          setCustomCommitMessage("feat: integrate Gemini LLM models, add Vector Search with Pinecone, use LangChain");
                          handleSimulatePush("feat: integrate Gemini LLM models, add Vector Search with Pinecone, use LangChain");
                        }}
                        disabled={simulating}
                        className="text-[10px] bg-slate-950 hover:bg-emerald-950/20 border border-slate-800 hover:border-emerald-500/30 text-slate-300 py-1.5 px-2 rounded-lg text-left transition truncate cursor-pointer"
                      >
                        🧠 AI & Vector DB Stack
                      </button>
                      <button
                        onClick={() => {
                          setCustomCommitMessage("refactor: configure AWS EKS cluster, migrate database to PostgreSQL, set up Terraform IAC");
                          handleSimulatePush("refactor: configure AWS EKS cluster, migrate database to PostgreSQL, set up Terraform IAC");
                        }}
                        disabled={simulating}
                        className="text-[10px] bg-slate-950 hover:bg-emerald-950/20 border border-slate-800 hover:border-emerald-500/30 text-slate-300 py-1.5 px-2 rounded-lg text-left transition truncate cursor-pointer"
                      >
                        ☁️ AWS & IaC Kubernetes Stack
                      </button>
                      <button
                        onClick={() => {
                          setCustomCommitMessage("refactor: modernize client code using Next.js 15, React 19, Tailwind CSS v4 runtime");
                          handleSimulatePush("refactor: modernize client code using Next.js 15, React 19, Tailwind CSS v4 runtime");
                        }}
                        disabled={simulating}
                        className="text-[10px] bg-slate-950 hover:bg-emerald-950/20 border border-slate-800 hover:border-emerald-500/30 text-slate-300 py-1.5 px-2 rounded-lg text-left transition truncate cursor-pointer"
                      >
                        🎨 Premium React Next.js Stack
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSimulatePush()}
                    disabled={simulating || !customCommitMessage.trim()}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black font-mono text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer mt-1"
                  >
                    {simulating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Pushing Webhook Updates...</span>
                      </>
                    ) : (
                      <>
                        <GitCommit className="w-3.5 h-3.5 text-slate-950" />
                        <span>git push</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>


            {/* RIGHT COLUMN: LIVING RESUME VIEW (7 cols) */}
            <div className="lg:col-span-7 flex flex-col bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
              
              {/* Doc header bar */}
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/90 relative z-10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-purple" />
                  <span className="font-display font-bold text-xs text-white uppercase tracking-wider">Living CV Portfolio</span>
                  <div className="h-4 w-[1px] bg-slate-800" />
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-brand-cyan" />
                    Last Updated: {resume.lastUpdated || "Just now"}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`text-[11px] font-mono font-semibold py-1 px-2.5 rounded ${
                      activeTab === 'preview'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('json')}
                    className={`text-[11px] font-mono font-semibold py-1 px-2.5 rounded ${
                      activeTab === 'json'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Actions strip */}
              <div className="px-5 py-2.5 bg-slate-800/30 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>⚡ Powered by live analyzed GitHub profile information</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJson}
                    className="hover:text-white transition flex items-center gap-1 font-mono cursor-pointer"
                  >
                    {clipboardCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-3.5 h-3.5" />
                        Copy JSON
                      </>
                    )}
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    onClick={triggerPrint}
                    className="hover:text-white transition flex items-center gap-1 font-mono text-brand-cyan cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                </div>
              </div>


              {/* Resume Sheet Body */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[720px] bg-white text-slate-900 print:bg-white print:text-black print:p-0">
                
                {activeTab === 'json' ? (
                  <pre className="font-mono text-xs bg-slate-950 text-slate-300 p-4 rounded-xl border border-slate-800 overflow-x-auto text-left selection:bg-brand-purple/40">
                    {JSON.stringify(resume, null, 2)}
                  </pre>
                ) : (
                  <div className="space-y-6 md:space-y-8 select-text">
                    
                    {/* Header Info */}
                    <div className="border-b-2 border-slate-200 pb-5 text-left">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                          <h2 className="font-display font-bold text-2xl md:text-3xl text-slate-950 leading-none mb-1">
                            {resume.name}
                          </h2>
                          <p className="font-mono text-xs md:text-sm text-violet-700 font-bold tracking-wide uppercase">
                            {resume.title}
                          </p>
                          <p className="text-xs text-slate-500 italic mt-1 bg-slate-100 py-1 border border-slate-200 px-2.5 rounded-md inline-block">
                            "{resume.slogan}"
                          </p>
                        </div>
                        
                        <div className="text-left md:text-right font-mono text-[10px] md:text-xs text-slate-600 space-y-0.5">
                          <div>📍 San Francisco, CA / Hybrid</div>
                          <div>✉️ developer@commitcv.link</div>
                          <div className="text-brand-purple font-semibold">★ Fully Analyzed Profile</div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="mt-4">
                        <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-sans">
                          {resume.summary}
                        </p>
                      </div>
                    </div>


                    {/* GitHub Statistics ticks */}
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-3 text-left">
                        GitHub Engagement Statistics & Scope
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">Repositories</span>
                          <span className="text-xl font-bold text-slate-900 font-display flex items-center gap-1.5 mt-0.5">
                            <Code className="w-4 h-4 text-slate-400" />
                            {resume.statistics.repositoriesCount}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">Total Commits</span>
                          <span className="text-xl font-bold text-slate-900 font-display flex items-center gap-1.5 mt-0.5">
                            <GitCommit className="w-4 h-4 text-rose-500 animate-pulse" />
                            {resume.statistics.commitsCount}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">Pull Requests</span>
                          <span className="text-xl font-bold text-slate-900 font-display flex items-center gap-1.5 mt-0.5">
                            <GitPullRequest className="w-4 h-4 text-blue-500" />
                            {resume.statistics.pullRequestsCount}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">Issues Solved</span>
                          <span className="text-xl font-bold text-slate-900 font-display flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            {resume.statistics.issuesCount}
                          </span>
                        </div>
                      </div>
                    </div>


                    {/* Technical Matrix */}
                    <div className="text-left">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-3.5 pb-1 border-b border-slate-200">
                        Technical Skills
                      </h3>

                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-1 pb-1">
                          <span className="md:col-span-3 text-[11px] font-mono uppercase text-slate-500 pt-1">Languages</span>
                          <div className="md:col-span-9 flex flex-wrap gap-1.5">
                            {resume.skills.languages?.map((lang, i) => (
                              <span
                                key={i}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  newlyAddedSkills.includes(lang)
                                    ? 'bg-brand-purple/15 text-violet-700 border-brand-purple animate-skill-glow font-bold'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-1 pb-1">
                          <span className="md:col-span-3 text-[11px] font-mono uppercase text-slate-500 pt-1">Frameworks</span>
                          <div className="md:col-span-9 flex flex-wrap gap-1.5">
                            {resume.skills.frameworks?.map((frm, i) => (
                              <span
                                key={i}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  newlyAddedSkills.includes(frm)
                                    ? 'bg-brand-purple/15 text-violet-700 border-brand-purple animate-skill-glow font-bold'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {frm}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-1 pb-1">
                          <span className="md:col-span-3 text-[11px] font-mono uppercase text-slate-500 pt-1">Databases</span>
                          <div className="md:col-span-9 flex flex-wrap gap-1.5">
                            {resume.skills.databases?.map((db, i) => (
                              <span
                                key={i}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  newlyAddedSkills.includes(db)
                                    ? 'bg-brand-purple/15 text-violet-700 border-brand-purple animate-skill-glow font-bold'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {db}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-1 pb-1">
                          <span className="md:col-span-3 text-[11px] font-mono uppercase text-slate-500 pt-1">Tools & DevOps</span>
                          <div className="md:col-span-9 flex flex-wrap gap-1.5">
                            {resume.skills.tools?.map((tool, i) => (
                              <span
                                key={i}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  newlyAddedSkills.includes(tool)
                                    ? 'bg-brand-purple/15 text-violet-700 border-brand-purple animate-skill-glow font-bold'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>


                    {/* Highlighted Projects */}
                    <div className="text-left">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-4 pb-1 border-b border-slate-200">
                        Highlighted Projects
                      </h3>

                      <div className="space-y-6">
                        {resume.projects?.map((project) => (
                           <div key={project.id} className="relative group pl-3.5 border-l-2 border-slate-200 hover:border-slate-400 transition pb-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-display font-semibold text-sm md:text-base text-slate-900 leading-tight">
                                  {project.name}
                                </h4>
                                <span className="text-[11px] font-mono text-slate-500 uppercase">
                                  {project.role}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                                {project.techStack?.map((s, i) => (
                                  <span key={i} className="text-[9px] font-mono bg-slate-100 text-slate-600 border border-slate-200/60 px-1.5 py-0.5 rounded-md">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <ul className="mt-2.5 space-y-1.5 text-xs text-slate-600 list-disc list-inside leading-relaxed">
                              {project.description?.map((bullet, index) => (
                                <li key={index} className="pl-1 text-slate-700">
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>


                    {/* Open Source Engagement */}
                    {resume.openSourceContributions && resume.openSourceContributions.length > 0 && (
                      <div className="text-left">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-3 pb-1 border-b border-slate-200">
                          Open Source Engagement
                        </h3>
                        <p className="text-xs text-slate-600 italic mb-3.5">
                          {resume.openSourceSummary}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {resume.openSourceContributions.map((contrib, i) => (
                            <div key={i} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
                                <span className="font-mono text-xs text-slate-900 font-bold">{contrib.project}</span>
                                <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-1.5 py-0.2">
                                  {contrib.prCount} PRs merged
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-normal pl-0.5">
                                <strong>Role: {contrib.role}</strong> — {contrib.highlight}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>


            </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* Styled clean footer */}
      <footer className="border-t border-slate-800 bg-slate-1000 relative z-10 py-5 text-center mt-auto px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <span>
            CommitCV
          </span>
        </div>
      </footer>

      {/* Floating Push Notification Slide-in Toast Overlay */}
      {showPushNotification && pushNotificationDetails && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900/95 backdrop-blur border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl shadow-emerald-500/10 transition-all duration-300">
          <div className="absolute top-2.5 right-2.5">
            <button 
              onClick={() => setShowPushNotification(false)}
              className="text-slate-400 hover:text-white transition text-xs bg-slate-800 hover:bg-slate-700 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer border-none"
            >
              ✕
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-emerald-400">Push Event Hook Active</h4>
              <p className="text-[10px] text-slate-400 font-mono">Pushed to {pushNotificationDetails.repository}</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-300 italic mb-3 font-mono border-l-2 border-slate-700 pl-2">
            "{pushNotificationDetails.commitMessage}"
          </p>

          <div className="bg-slate-950 rounded-xl p-3 mb-3 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">AI Skill Extractions:</span>
            <div className="mt-1.5 space-y-1 font-mono text-xs text-left">
              {pushNotificationDetails.addedSkills && pushNotificationDetails.addedSkills.length > 0 ? (
                pushNotificationDetails.addedSkills.map((skill, index) => (
                  <div key={index} className="text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="text-emerald-500">+</span>
                    <span>{skill}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic text-[11px]">No new skills detected in this revision.</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono mt-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg py-1.5 px-2.5">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Resume Updated
            </span>
            <span className="text-slate-500 text-[9px]">{pushNotificationDetails.timestamp}</span>
          </div>
        </div>
      )}

    </div>
  );
}
