/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Clock,
  LayoutTemplate,
  Save,
  BrainCircuit,
  ShieldAlert,
  Compass
} from 'lucide-react';
import { CommitCVResume, ChatMessage, ResumeContact } from './types';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import AICareerCoach from './components/AICareerCoach';
import ResumePreview from './components/ResumePreview';
import {
  DEFAULT_RESUME_FORMAT,
  RESUME_FORMAT_OPTIONS,
  ResumeFormatId,
  getResumeFormatOption,
  resolveResumeFormat,
} from './resumeFormats';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [githubToken, setGithubToken] = useState<string>('');
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [oauthLoading, setOauthLoading] = useState<boolean>(false);
  const [publicScanLoading, setPublicScanLoading] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
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
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState<boolean>(false);
  const [copiedHomepageUrl, setCopiedHomepageUrl] = useState<boolean>(false);
  const [showTryItOutModal, setShowTryItOutModal] = useState<boolean>(false);
  const [firestoreAvailable, setFirestoreAvailable] = useState<boolean>(true);
  const [selectedFormat, setSelectedFormat] = useState<ResumeFormatId>(DEFAULT_RESUME_FORMAT);

  // Auto-close "Try It Out" modal when resume is successfully loaded
  useEffect(() => {
    if (resume && showTryItOutModal) {
      setShowTryItOutModal(false);
    }
  }, [resume, showTryItOutModal]);

  // Update relative time display every minute
  useEffect(() => {
    if (!resume || typeof resume.lastUpdated !== 'number') return;
    
    const interval = setInterval(() => {
      // Force re-render to update relative time
      setResume((prev) => prev ? { ...prev } : prev);
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [resume?.lastUpdated]);
  const [contactDraft, setContactDraft] = useState({
    name: '',
    location: '',
    email: '',
    age: '',
    languages: '',
  });
  const [socialMediaDraft, setSocialMediaDraft] = useState({
    linkedin: '',
    twitter: '',
    instagram: '',
    facebook: '',
  });
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [repoAction, setRepoAction] = useState<'description' | 'tech-stack'>('description');
  const [showContactDetails, setShowContactDetails] = useState<boolean>(false);
  const [showRepoActions, setShowRepoActions] = useState<boolean>(false);
  const [showOpenSource, setShowOpenSource] = useState<boolean>(false);
  const [showSocialMedia, setShowSocialMedia] = useState<boolean>(false);
  const [showFontSettings, setShowFontSettings] = useState<boolean>(false);
  const [showTechStackManager, setShowTechStackManager] = useState<boolean>(false);
  const [techStackCategory, setTechStackCategory] = useState<'languages' | 'frameworks' | 'databases' | 'tools'>('languages');
  const [customTechInput, setCustomTechInput] = useState<string>('');
  const [allUserRepos, setAllUserRepos] = useState<Array<{id: string, name: string, inResume: boolean}>>([]);
  const [savingChat, setSavingChat] = useState<boolean>(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState<boolean>(false);
  
  // Webhook state
  const [webhookEnabled, setWebhookEnabled] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<{ totalRepos: number; reposWithWebhook: number; coverage: number } | null>(null);
  const [settingUpWebhook, setSettingUpWebhook] = useState<boolean>(false);
  const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);

  // Helper function to get relative time
  const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Memoize contribution grid cells to prevent re-renders that conflict with GSAP
  const contributionCells = useMemo(() => 
    Array.from({ length: 350 }).map((_, i) => {
      const level = Math.random() > 0.85 ? Math.floor(Math.random() * 4) + 1 : 0;
      return {
        id: i,
        level,
      };
    }),
  []);

  // Auto scroll chat to bottom
  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Handle incoming postMessages/storage synchronizations from GitHub OAuth Window popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      console.log('==============================================');
      console.log('[OAUTH MESSAGE] 📨 Received postMessage event');
      console.log('[OAUTH MESSAGE] Event type:', event.data?.type);
      console.log('[OAUTH MESSAGE] Has token:', !!event.data?.token);
      console.log('==============================================');
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.token;
        console.log('[OAUTH MESSAGE] ✅ OAuth success! Token received');
        
        setGithubToken(token);
        console.log('[OAUTH MESSAGE] - setGithubToken() called');
        
        setIsAuthenticated(true);
        console.log('[OAUTH MESSAGE] - setIsAuthenticated(true)');
        
        setOauthLoading(false);
        console.log('[OAUTH MESSAGE] - setOauthLoading(false)');
        
        console.log('[OAUTH MESSAGE] Calling triggerAnalysis with token...');
        triggerAnalysis(token, null);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      console.log('==============================================');
      console.log('[STORAGE EVENT] 💾 Storage change detected');
      console.log('[STORAGE EVENT] Key:', event.key);
      console.log('[STORAGE EVENT] Has newValue:', !!event.newValue);
      console.log('==============================================');
      
      if (event.key === 'github_oauth_token' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          console.log('[STORAGE EVENT] Parsed token data, has token:', !!parsed.token);
          
          if (parsed.token) {
            console.log('[STORAGE EVENT] ✅ Valid token found in storage');
            
            setGithubToken(parsed.token);
            console.log('[STORAGE EVENT] - setGithubToken() called');
            
            setIsAuthenticated(true);
            console.log('[STORAGE EVENT] - setIsAuthenticated(true)');
            
            setOauthLoading(false);
            console.log('[STORAGE EVENT] - setOauthLoading(false)');
            
            console.log('[STORAGE EVENT] Calling triggerAnalysis with token...');
            triggerAnalysis(parsed.token, null);
            
            // Clear once retrieved to prevent re-triggering
            localStorage.removeItem('github_oauth_token');
            console.log('[STORAGE EVENT] - Cleared localStorage token');
          }
        } catch (e) {
          console.error('[STORAGE EVENT] ❌ Error parsing token from storage:', e);
        }
      }
    };

    // Callback fallback scanner (for checking if token is written to same-origin localStorage already)
    const checkLocalStorageToken = () => {
      const stored = localStorage.getItem('github_oauth_token');
      if (stored) {
        console.log('[LOCAL STORAGE CHECK] Found token in localStorage');
        try {
          const parsed = JSON.parse(stored);
          if (parsed.token) {
            console.log('[LOCAL STORAGE CHECK] ✅ Valid token, initiating auth flow');
            
            setGithubToken(parsed.token);
            setIsAuthenticated(true);
            setOauthLoading(false);
            
            console.log('[LOCAL STORAGE CHECK] Calling triggerAnalysis...');
            triggerAnalysis(parsed.token, null);
            
            localStorage.removeItem('github_oauth_token');
            console.log('[LOCAL STORAGE CHECK] - Token cleared from localStorage');
          }
        } catch (e) {
          console.error('[LOCAL STORAGE CHECK] ❌ Error parsing token:', e);
        }
      }
    };

    console.log('[OAUTH EFFECT] Setting up OAuth listeners');
    window.addEventListener('message', handleOAuthMessage);
    window.addEventListener('storage', handleStorageChange);

    // Run custom high-frequency checker for instant OAuth feedback inside sandbox frames
    const checkInterval = setInterval(checkLocalStorageToken, 1000);
    console.log('[OAUTH EFFECT] Started localStorage polling (1s interval)');

    // Initial check on mounting/refreshing
    console.log('[OAUTH EFFECT] Running initial localStorage check');
    checkLocalStorageToken();

    return () => {
      console.log('[OAUTH EFFECT] Cleanup - removing listeners and interval');
      window.removeEventListener('message', handleOAuthMessage);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  // GSAP ScrollTrigger Landing Page Animations
  // Only run when resume is null (landing page mode)
  useEffect(() => {
    console.log('[GSAP Effect] Running, resume=', !!resume);
    
    if (resume) {
      console.log('[GSAP Effect] Skipping - resume exists');
      return;
    }

    // Ensure we're in browser environment
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let ctx: gsap.Context | null = null;
    
    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      if (!isMounted) {
        console.log('[GSAP Effect] Aborted - component unmounted');
        return;
      }
      
      console.log('[GSAP Effect] Starting GSAP context');
      
      ctx = gsap.context(() => {
        // Section 1: Hero Animations
        gsap.set(".hero-title", { y: 100, opacity: 0 });
        gsap.set(".hero-subtitle", { y: 50, opacity: 0 });
        gsap.set(".hero-scroll-indicator", { opacity: 0 });
        
        gsap.to(".hero-title", {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out"
        });

        gsap.to(".hero-subtitle", {
          y: 0,
          opacity: 1,
          duration: 1,
          delay: 0.3,
          ease: "power3.out"
        });

        gsap.to(".hero-scroll-indicator", {
          opacity: 1,
          duration: 1,
          delay: 0.8
        });

        // Contribution nodes stagger color updates
        const cells = document.querySelectorAll('.contribution-node-cell');
        if (cells.length > 0) {
          gsap.to(cells, {
            backgroundColor: () => {
              const rand = Math.random();
              if (rand > 0.96) return '#4ade80';
              if (rand > 0.90) return '#22c55e';
              if (rand > 0.80) return '#15803d';
              if (rand > 0.65) return '#166534';
              return 'rgba(30, 41, 59, 0.4)';
            },
            duration: 1.5,
            stagger: {
              each: 0.01,
              from: "random",
              repeat: -1,
              yoyo: true
            }
          });
        }

        // Section 2: The Problem ScrollTrigger
        gsap.set(".problem-answer", { opacity: 0, y: 20 });
        
        const problemTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".problem-section",
            start: "top center-=250",
            end: "bottom center+=250",
            scrub: true
          }
        });

        problemTl.to(".problem-skill", {
          borderColor: "rgba(30, 41, 59, 0.2)",
          backgroundColor: "rgba(15, 23, 42, 0.2)",
          filter: "grayscale(1) opacity(0.25)",
          stagger: 0.1
        });

        problemTl.to(".problem-answer", {
          opacity: 1,
          y: 0,
          duration: 0.5
        }, "-=0.2");

        // Section 3: GitHub Connect ScrollTrigger
        gsap.set(".connect-floating", { opacity: 0 });
        
        const connectTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".connect-section",
            start: "top center",
            end: "bottom center",
            scrub: true
          }
        });

        connectTl.to(".connect-floating", {
          x: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 1
        });

        connectTl.to(".connect-floating", {
          scale: 0.1,
          left: "50%",
          top: "50%",
          x: 0,
          y: 0,
          opacity: 0,
          duration: 0.8,
          stagger: 0.05
        });

        connectTl.to(".ai-core", {
          boxShadow: "0 0 80px rgba(139, 92, 246, 0.9), 0 0 160px rgba(6, 182, 212, 0.6)",
          scale: 1.15,
          duration: 0.4
        }, "-=0.2");

        // Section 4: AI Analysis ScrollTrigger 
        // NOTE: Removed 'pin' to avoid React 19 DOM conflicts
        gsap.set('[data-commit="redis"]', { opacity: 0.2, scale: 1 });
        gsap.set('[data-commit="jwt"]', { opacity: 0.2, scale: 1 });
        gsap.set('[data-commit="docker"]', { opacity: 0.2, scale: 1 });
        gsap.set('[data-skill="redis"]', { opacity: 0, scale: 0.5 });
        gsap.set('[data-skill="jwt"]', { opacity: 0, scale: 0.5 });
        gsap.set('[data-skill="docker"]', { opacity: 0, scale: 0.5 });
        gsap.set('.analysis-scorecard', { opacity: 0.2 });
        gsap.set('[data-progress="82"]', { width: "0%" });
        gsap.set('[data-progress="74"]', { width: "0%" });
        gsap.set('[data-progress="58"]', { width: "0%" });
        
        const analysisTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".analysis-section",
            start: "top center-=200",
            end: "bottom center+=250",
            scrub: true
          }
        });

        analysisTl.to('[data-commit="redis"]', { opacity: 1, scale: 1.05, duration: 0.5 })
                  .to('[data-skill="redis"]', { opacity: 1, scale: 1.15, duration: 0.5 }, "-=0.2")
                  .to('[data-skill="redis"]', { y: 80, x: 20, opacity: 0, scale: 0.4, duration: 0.8 }) 
                  .to('.analysis-scorecard', { opacity: 0.4, duration: 0.2 }, "-=0.8");

        analysisTl.to('[data-commit="jwt"]', { opacity: 1, scale: 1.05, duration: 0.5 })
                  .to('[data-skill="jwt"]', { opacity: 1, scale: 1.15, duration: 0.5 }, "-=0.2")
                  .to('[data-skill="jwt"]', { y: 20, x: -50, opacity: 0, scale: 0.4, duration: 0.8 })
                  .to('.analysis-scorecard', { opacity: 0.7, duration: 0.2 }, "-=0.8");

        analysisTl.to('[data-commit="docker"]', { opacity: 1, scale: 1.05, duration: 0.5 })
                  .to('[data-skill="docker"]', { opacity: 1, scale: 1.15, duration: 0.5 }, "-=0.2")
                  .to('[data-skill="docker"]', { y: -40, x: 0, opacity: 0, scale: 0.4, duration: 0.8 })
                  .to('.analysis-scorecard', { opacity: 1, duration: 0.2 }, "-=0.8");

        analysisTl.to('[data-progress="82"]', { width: "82%", duration: 1 })
                  .to('[data-progress="74"]', { width: "74%", duration: 1 }, "-=0.8")
                  .to('[data-progress="58"]', { width: "58%", duration: 1 }, "-=0.8");

        // Section 5: Living Resume ScrollTrigger
        gsap.set('[data-activity="docker"]', { opacity: 0.3 });
        gsap.set('[data-activity="redis"]', { opacity: 0.3 });
        gsap.set('[data-activity="cicd"]', { opacity: 0.3 });
        gsap.set('[data-resume-skill="docker"]', { opacity: 0, scale: 0.5 });
        gsap.set('[data-resume-skill="redis"]', { opacity: 0, scale: 0.5 });
        gsap.set('[data-resume-skill="cicd"]', { opacity: 0, scale: 0.5 });
        gsap.set('[data-highlight="docker"]', { opacity: 0 });
        gsap.set('[data-highlight="redis"]', { opacity: 0 });
        
        const livingTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".living-resume-section",
            start: "top center-=300",
            end: "bottom center+=400",
            scrub: true
          }
        });

        livingTl.to('[data-activity="docker"]', { opacity: 1, duration: 0.5 })
                .to('[data-resume-skill="docker"]', { opacity: 1, scale: 1, duration: 0.5 }, "-=0.2")
                .to('[data-highlight="docker"]', { opacity: 1, duration: 0.3 }, "-=0.1");

        livingTl.to('[data-activity="redis"]', { opacity: 1, duration: 0.5 })
                .to('[data-resume-skill="redis"]', { opacity: 1, scale: 1, duration: 0.5 }, "-=0.2")
                .to('[data-highlight="redis"]', { opacity: 1, duration: 0.3 }, "-=0.1");

        livingTl.to('[data-activity="cicd"]', { opacity: 1, duration: 0.5 })
                .to('[data-resume-skill="cicd"]', { opacity: 1, scale: 1, duration: 0.5 }, "-=0.2");

        // Section 6: AI Career Coach ScrollTrigger
        gsap.set('.coach-title', { opacity: 0, y: 50 });
        gsap.set('.coach-subtitle', { opacity: 0, y: 30 });
        gsap.set('.career-path-card', { opacity: 0, x: -100 });
        gsap.set('.coach-cta', { opacity: 0, y: 30 });
        
        const coachTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".career-coach-section",
            start: "top center-=200",
            end: "bottom center+=300",
            scrub: true
          }
        });

        // Title and subtitle fade in
        coachTl.to('.coach-title', { opacity: 1, y: 0, duration: 0.5 })
               .to('.coach-subtitle', { opacity: 1, y: 0, duration: 0.5 }, "-=0.3");

        // Career path cards slide in from left with stagger
        coachTl.to('[data-path="backend"]', { opacity: 1, x: 0, duration: 0.6 }, "-=0.2")
               .to('[data-path="frontend"]', { opacity: 1, x: 0, duration: 0.6 }, "-=0.4")
               .to('[data-path="devops"]', { opacity: 1, x: 0, duration: 0.6 }, "-=0.4")
               .to('[data-path="ml"]', { opacity: 1, x: 0, duration: 0.6 }, "-=0.4")
               .to('[data-path="mobile"]', { opacity: 1, x: 0, duration: 0.6 }, "-=0.4")
               .to('[data-path="security"]', { opacity: 1, x: 0, duration: 0.6 }, "-=0.4");

        // CTA section fades in
        coachTl.to('.coach-cta', { opacity: 1, y: 0, duration: 0.8 });
      });
    });

    return () => {
      console.log('[GSAP Effect] Cleanup starting, isMounted=', isMounted, 'ctx=', !!ctx);
      isMounted = false;
      cancelAnimationFrame(rafId);
      
      // Kill all ScrollTriggers first
      const triggers = ScrollTrigger.getAll();
      console.log('[GSAP Effect] Killing', triggers.length, 'ScrollTriggers');
      triggers.forEach((trigger) => trigger.kill());
      
      // Then revert the GSAP context
      if (ctx) {
        console.log('[GSAP Effect] Reverting GSAP context');
        ctx.revert();
      }
      console.log('[GSAP Effect] Cleanup complete');
    };
  }, [resume]);

  // Real-time listener for Firestore push updates
  useEffect(() => {
    if (!githubUsername || !firestoreAvailable) return;
    
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
      if (error?.code === 'permission-denied') {
        setFirestoreAvailable(false);
      }
    });
    
    return () => unsubscribe();
  }, [githubUsername, firestoreAvailable]);

  // Set up real GitHub OAuth Login Flow
  const handleGithubConnect = async () => {
    setErrorBanner(null);
    try {
      setOauthLoading(true);
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
          setOauthLoading(false);
        }
        // Note: OAuth loading state will be cleared when message is received
      } else {
        setErrorBanner(data.error || 'GitHub OAuth variables not configured. Please use the "Public Username Scan" on the left, or add GITHUB_CLIENT_ID to your secrets!');
        setOauthLoading(false);
      }
    } catch (err) {
      console.error(err);
      setErrorBanner('Failed to initialize OAuth. Please use the "Public Username Scan" instead, or check the developer console.');
      setOauthLoading(false);
    }
  };

  // Trigger Resume analyzer from server-side using Gemini 3.5 Flash, checking Firestore first (unless forceReload is active)
  const triggerAnalysis = async (token: string | null, username: string | null, forceReload: boolean = false) => {
    console.log('==============================================');
    console.log('[triggerAnalysis] 🚀 FUNCTION CALLED');
    console.log('[triggerAnalysis] Parameters:', { 
      hasToken: !!token, 
      username, 
      forceReload,
      currentResume: !!resume,
      currentGithubUsername: githubUsername
    });
    console.log('==============================================');
    
    console.log('[triggerAnalysis] Step 1: Setting initial states');
    setLoading(true);
    console.log('[triggerAnalysis] - loading set to TRUE');
    setNewlyAddedSkills([]);
    setAnalysisProgress('Initializing...');
    console.log('[triggerAnalysis] - analysisProgress set to "Initializing..."');
    
    // Scroll to Resume Portfolio Copilot section if it exists
    setTimeout(() => {
      const portfolioSection = document.querySelector('[data-section="portfolio"]');
      console.log('[triggerAnalysis] Scroll attempt - portfolio section exists:', !!portfolioSection);
      if (portfolioSection) {
        portfolioSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('[triggerAnalysis] ✅ Scrolled to portfolio section');
      }
    }, 300);
    
    const targetUsername = username ? username.trim().replace(/@/g, '') : '';
    const cleanUsernameLower = targetUsername.toLowerCase();
    console.log('[triggerAnalysis] Step 2: Processed username');
    console.log('[triggerAnalysis] - targetUsername:', targetUsername);
    console.log('[triggerAnalysis] - cleanUsernameLower:', cleanUsernameLower);

    // Check Firestore first
    if (firestoreAvailable && !forceReload && cleanUsernameLower) {
      try {
        console.log('[triggerAnalysis] Step 3a: Checking Firestore cache');
        console.log('[triggerAnalysis] - firestoreAvailable:', firestoreAvailable);
        console.log('[triggerAnalysis] - forceReload:', forceReload);
        setAnalysisProgress('Checking cached data...');
        
        const docRef = doc(db, 'resumes', cleanUsernameLower);
        console.log('[triggerAnalysis] - Firestore document path:', `resumes/${cleanUsernameLower}`);
        
        const docSnap = await getDoc(docRef);
        console.log('[triggerAnalysis] - Firestore query result - exists:', docSnap.exists());
        
        if (docSnap.exists()) {
          console.log('[triggerAnalysis] ✅ FOUND CACHED RESUME IN FIRESTORE');
          const loadedResume = docSnap.data() as CommitCVResume;
          console.log('[triggerAnalysis] - Loaded resume name:', loadedResume?.name);
          console.log('[triggerAnalysis] - Loaded resume projects count:', loadedResume?.projects?.length);
          
          console.log('[triggerAnalysis] Step 4a: Setting resume state from cache');
          setResume(loadedResume);
          console.log('[triggerAnalysis] - setResume() called with cached data');
          
          setGithubUsername(targetUsername);
          console.log('[triggerAnalysis] - setGithubUsername() called:', targetUsername);
          
          setChatHistoryLoaded(false);
          console.log('[triggerAnalysis] - setChatHistoryLoaded(false)');
          
          console.log('[triggerAnalysis] Step 5a: Clearing loading states (cache path)');
          setLoading(false);
          console.log('[triggerAnalysis] - loading set to FALSE');
          setPublicScanLoading(false);
          console.log('[triggerAnalysis] - publicScanLoading set to FALSE');
          setAnalysisProgress('');
          console.log('[triggerAnalysis] - analysisProgress cleared');
          
          console.log('==============================================');
          console.log('[triggerAnalysis] ✅ CACHE PATH COMPLETE - Resume should be visible now!');
          console.log('[triggerAnalysis] Current state should be:');
          console.log('  - resume: SET (from cache)');
          console.log('  - loading: false');
          console.log('  - publicScanLoading: false');
          console.log('==============================================');
          return;
        } else {
          console.log('[triggerAnalysis] ⚠️ No cached resume found in Firestore - will fetch from API');
        }
      } catch (err) {
        console.error('[triggerAnalysis] ❌ Firestore cache check failed:', err);
        console.warn("Failed to retrieve cached profile from Firebase Firestore, pulling from live API:", err);
        if ((err as any)?.code === 'permission-denied') {
          setFirestoreAvailable(false);
          console.log('[triggerAnalysis] - Firestore disabled due to permission error');
        }
      }
    } else {
      console.log('[triggerAnalysis] Step 3b: Skipping Firestore cache check');
      console.log('[triggerAnalysis] - Reasons:', {
        firestoreAvailable,
        forceReload,
        hasUsername: !!cleanUsernameLower
      });
    }

    try {
      console.log('[triggerAnalysis] Step 4b: Fetching from API');
      setAnalysisProgress('Fetching GitHub profile...');
      console.log('[triggerAnalysis] - API endpoint: /api/github/analyze');
      console.log('[triggerAnalysis] - Request body:', { 
        hasToken: !!token, 
        username: targetUsername || null 
      });
      
      const fetchStartTime = Date.now();
      const response = await fetch('/api/github/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          username: targetUsername || null
        })
      });
      const fetchEndTime = Date.now();
      console.log('[triggerAnalysis] - API fetch completed in', (fetchEndTime - fetchStartTime) / 1000, 'seconds');
      
      setAnalysisProgress('Analyzing repositories...');
      
      const parseStartTime = Date.now();
      const data = await response.json();
      const parseEndTime = Date.now();
      console.log('[triggerAnalysis] - JSON parsed in', (parseEndTime - parseStartTime) / 1000, 'seconds');
      
      console.log('[triggerAnalysis] Step 5b: API response received');
      console.log('[triggerAnalysis] - response.ok:', response.ok);
      console.log('[triggerAnalysis] - has resume data:', !!data.resume);
      console.log('[triggerAnalysis] - data.username:', data.username);
      console.log('[triggerAnalysis] - error (if any):', data.error);
      
      if (response.ok && data.resume) {
        setAnalysisProgress('Generating resume...');
        console.log('[triggerAnalysis] ✅ API SUCCESS - Resume data received');
        console.log('[triggerAnalysis] - Resume name:', data.resume.name);
        console.log('[triggerAnalysis] - Projects count:', data.resume.projects?.length);
        console.log('[triggerAnalysis] - Skills:', data.resume.skills);
        
        console.log('[triggerAnalysis] Step 6b: Setting resume state from API');
        setResume(data.resume);
        console.log('[triggerAnalysis] - setResume() called with API data');
        
        // Persist to Firestore as the master record
        const finalUsername = (targetUsername || data.username || data.resume.name).trim().replace(/@/g, '');
        console.log('[triggerAnalysis] - Final username for persistence:', finalUsername);
        
        if (finalUsername) {
          setGithubUsername(finalUsername);
          console.log('[triggerAnalysis] - setGithubUsername() called:', finalUsername);
          
          if (firestoreAvailable) {
            try {
              setAnalysisProgress('Saving to database...');
              console.log('[triggerAnalysis] - Saving to Firestore...');
              const saveStartTime = Date.now();
              await setDoc(doc(db, 'resumes', finalUsername.toLowerCase()), data.resume);
              const saveEndTime = Date.now();
              console.log('[triggerAnalysis] - ✅ Saved to Firestore in', (saveEndTime - saveStartTime) / 1000, 'seconds');
            } catch (firebaseErr: any) {
              console.error("[triggerAnalysis] ❌ Failed to save to Firestore:", firebaseErr);
              if (firebaseErr?.code === 'permission-denied') {
                setFirestoreAvailable(false);
              }
            }
          }
        }

        setChatHistoryLoaded(false);
        console.log('[triggerAnalysis] - setChatHistoryLoaded(false)');
        
        setAnalysisProgress('Complete!');
        console.log('[triggerAnalysis] - analysisProgress set to "Complete!"');
        
        console.log('[triggerAnalysis] Step 7b: Scheduling final cleanup');
        
        // Clear progress message after a short delay
        setTimeout(() => {
          console.log('[triggerAnalysis] Delayed cleanup - clearing analysisProgress');
          setAnalysisProgress('');
        }, 1000);
        
        console.log('==============================================');
        console.log('[triggerAnalysis] ✅ API PATH COMPLETE - About to clear loading states');
        console.log('[triggerAnalysis] Next: finally block will execute');
        console.log('==============================================');
      } else {
        console.log('[triggerAnalysis] ❌ API response not OK or no resume data');
        throw new Error(data.error || 'Failed to complete resume analysis.');
      }
    } catch (err: any) {
      console.error('[triggerAnalysis] ❌ ERROR in try block:', err);
      console.error('[triggerAnalysis] Error details:', {
        message: err.message,
        stack: err.stack
      });
      setErrorBanner(err.message || 'Analysis failed. Make sure the username has active repositories, and check if your OpenRouter credentials are fully set up!');
      setAnalysisProgress('');
    } finally {
      console.log('==============================================');
      console.log('[triggerAnalysis] 🏁 FINALLY BLOCK EXECUTING');
      console.log('[triggerAnalysis] - Current loading state before change:', loading);
      console.log('[triggerAnalysis] - Current publicScanLoading before change:', publicScanLoading);
      
      setLoading(false);
      console.log('[triggerAnalysis] - ✅ loading set to FALSE');
      
      setPublicScanLoading(false);
      console.log('[triggerAnalysis] - ✅ publicScanLoading set to FALSE');
      
      console.log('[triggerAnalysis] 🎉 FUNCTION COMPLETE');
      console.log('[triggerAnalysis] Expected UI state:');
      console.log('  - resume: should be SET');
      console.log('  - loading: false');
      console.log('  - publicScanLoading: false');
      console.log('  - Should show: Resume workspace (not landing page)');
      console.log('==============================================');
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
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
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
        if (firestoreAvailable && finalUsername) {
          try {
            await setDoc(doc(db, 'resumes', finalUsername.toLowerCase()), data.updatedResume);
          } catch (firebaseErr: any) {
            console.error("Failed to sync edited updates to Firebase Firestore:", firebaseErr);
            if (firebaseErr?.code === 'permission-denied') {
              setFirestoreAvailable(false);
            }
          }
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data.chatResponse || "Resume updated to reflect changes successfully.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        
        // Save chat history to Firestore
        const username = githubUsername || data.updatedResume.name;
        if (username) {
          await saveChatHistory(username, finalMessages);
        }
        
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
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: `Error updating the resume structure: ${err.message || 'API query error'}. Let's re-try another request.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      
      // Save even error messages
      const username = githubUsername || resume?.name;
      if (username) {
        await saveChatHistory(username, finalMessages);
      }
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

  const persistResume = async (updatedResume: CommitCVResume) => {
    const finalUsername = (githubUsername || updatedResume.name).trim().replace(/@/g, '');
    if (!firestoreAvailable || !finalUsername) return;
    try {
      await setDoc(doc(db, 'resumes', finalUsername.toLowerCase()), updatedResume);
    } catch (firebaseErr: any) {
      console.error('Failed to sync resume to Firebase Firestore:', firebaseErr);
      if (firebaseErr?.code === 'permission-denied') {
        setFirestoreAvailable(false);
      }
      throw firebaseErr;
    }
  };

  // Save chat history to Firestore
  const saveChatHistory = async (username: string, chatMessages: ChatMessage[]) => {
    if (!firestoreAvailable || !username) return;
    const cleanUsernameLower = username.trim().replace(/@/g, '').toLowerCase();
    
    setSavingChat(true);
    try {
      // Save each message as a document in the chatHistory subcollection
      const chatHistoryRef = collection(db, 'resumes', cleanUsernameLower, 'chatHistory');
      
      // Clear existing messages first
      const existingQuery = query(chatHistoryRef);
      const existingDocs = await getDocs(existingQuery);
      const deletePromises = existingDocs.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      
      // Add new messages
      const savePromises = chatMessages.map(msg => 
        setDoc(doc(chatHistoryRef, msg.id), msg)
      );
      await Promise.all(savePromises);
      
      console.log(`Saved ${chatMessages.length} chat messages for ${cleanUsernameLower}`);
    } catch (err: any) {
      console.error('Failed to save chat history:', err);
      if (err?.code === 'permission-denied') {
        setFirestoreAvailable(false);
      }
    } finally {
      setSavingChat(false);
    }
  };

  // Load chat history from Firestore
  const loadChatHistory = async (username: string) => {
    if (!firestoreAvailable || !username) return [];
    const cleanUsernameLower = username.trim().replace(/@/g, '').toLowerCase();
    
    try {
      const chatHistoryRef = collection(db, 'resumes', cleanUsernameLower, 'chatHistory');
      const q = query(chatHistoryRef, orderBy('timestamp', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const loadedMessages: ChatMessage[] = [];
      querySnapshot.forEach((docSnap) => {
        loadedMessages.push(docSnap.data() as ChatMessage);
      });
      
      console.log(`Loaded ${loadedMessages.length} chat messages for ${cleanUsernameLower}`);
      return loadedMessages;
    } catch (err: any) {
      console.error('Failed to load chat history:', err);
      if (err?.code === 'permission-denied') {
        setFirestoreAvailable(false);
      }
      return [];
    }
  };

  // Clear chat history
  const clearChatHistory = async () => {
    if (!githubUsername && !resume?.name) return;
    const username = githubUsername || resume?.name || '';
    const cleanUsernameLower = username.trim().replace(/@/g, '').toLowerCase();
    
    try {
      if (firestoreAvailable) {
        const chatHistoryRef = collection(db, 'resumes', cleanUsernameLower, 'chatHistory');
        const q = query(chatHistoryRef);
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(deletePromises);
      }
      setMessages([]);
      setChatHistoryLoaded(false);
    } catch (err: any) {
      console.error('Failed to clear chat history:', err);
      setErrorBanner('Failed to clear chat history.');
    }
  };

  // Check webhook status
  const checkWebhookStatus = async () => {
    if (!githubToken) return;
    
    try {
      const response = await fetch(`/api/webhook/status?token=${encodeURIComponent(githubToken)}`);
      const data = await response.json();
      
      if (response.ok) {
        setWebhookEnabled(data.enabled);
        setWebhookStatus({
          totalRepos: data.totalRepos,
          reposWithWebhook: data.reposWithWebhook,
          coverage: data.coverage
        });
      }
    } catch (err: any) {
      console.error('Failed to check webhook status:', err);
    }
  };

  // Setup webhooks for all repositories
  const setupWebhooks = async () => {
    if (!githubToken || !githubUsername) return;
    
    setSettingUpWebhook(true);
    setErrorBanner(null);
    
    try {
      const response = await fetch('/api/webhook/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          username: githubUsername
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setWebhookEnabled(true);
        setWebhookStatus({
          totalRepos: data.totalRepos,
          reposWithWebhook: data.successCount,
          coverage: Math.round((data.successCount / data.totalRepos) * 100)
        });
        
        // Show success message
        setMessages(prev => [
          ...prev,
          {
            id: `webhook-setup-${Date.now()}`,
            sender: 'assistant',
            text: `🎉 **Live Updates Enabled!**\n\n✅ Successfully configured webhooks for ${data.successCount} repositories\n${data.failureCount > 0 ? `⚠️ ${data.failureCount} repositories failed to configure\n` : ''}\nYour resume will now auto-update every time you push code! 🚀`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        
        setShowWebhookModal(false);
      } else {
        throw new Error(data.error || 'Failed to setup webhooks');
      }
    } catch (err: any) {
      console.error('Failed to setup webhooks:', err);
      setErrorBanner(`Webhook setup failed: ${err.message}`);
    } finally {
      setSettingUpWebhook(false);
    }
  };

  // Check webhook status when authenticated
  useEffect(() => {
    if (isAuthenticated && githubToken && resume) {
      checkWebhookStatus();
    }
  }, [isAuthenticated, githubToken, resume]);

  const handleFormatChange = async (formatId: ResumeFormatId) => {
    if (!resume || formatId === selectedFormat) return;
    setSelectedFormat(formatId);
    const updatedResume: CommitCVResume = {
      ...resume,
      resumeFormat: formatId,
      lastUpdated: Date.now(),
    };
    setResume(updatedResume);
    try {
      await persistResume(updatedResume);
    } catch {
      setErrorBanner('Failed to save resume format to Firestore. Please try again.');
    }
  };

  // Sync format selector when resume loads from Firestore or API
  useEffect(() => {
    setSelectedFormat(resolveResumeFormat(resume?.resumeFormat));
  }, [resume?.resumeFormat, resume?.name]);

  useEffect(() => {
    if (!resume) return;
    setContactDraft({
      name: resume.name || '',
      location: resume.contact?.location || '',
      email: resume.contact?.email || '',
      age: resume.contact?.age || '',
      languages: resume.contact?.languages?.join(', ') || '',
    });
    setSocialMediaDraft({
      linkedin: resume.contact?.linkedin || '',
      twitter: resume.contact?.twitter || '',
      instagram: resume.contact?.instagram || '',
      facebook: resume.contact?.facebook || '',
    });
    if (resume.projects?.length) {
      setSelectedRepoId((prev) =>
        prev && resume.projects.some((p) => p.id === prev) ? prev : resume.projects[0].id
      );
    }
  }, [resume?.name, resume?.contact, resume?.projects]);

  // Fetch all user repositories when resume is loaded
  useEffect(() => {
    if (!resume || !githubUsername) return;
    
    const fetchAllRepos = async () => {
      try {
        const response = await fetch(`/api/github/repos?username=${encodeURIComponent(githubUsername)}`);
        if (response.ok) {
          const data = await response.json();
          const repos = data.repositories || [];
          // Mark which repos are currently in resume
          const repoList = repos
            .filter((r: any) => r.name.toLowerCase() !== githubUsername.toLowerCase()) // Exclude README repo
            .map((r: any) => ({
              id: r.name,
              name: r.name,
              inResume: resume.projects.some(p => p.name === r.name)
            }));
          setAllUserRepos(repoList);
        }
      } catch (err) {
        console.error('Failed to fetch all repositories:', err);
      }
    };
    
    fetchAllRepos();
  }, [resume?.name, githubUsername]);

  // Load chat history when resume is loaded
  useEffect(() => {
    if (!resume || chatHistoryLoaded || !githubUsername) return;
    
    const loadHistory = async () => {
      const history = await loadChatHistory(githubUsername || resume.name);
      if (history.length > 0) {
        setMessages(history);
        setChatHistoryLoaded(true);
      } else {
        // Set initial system message if no history exists
        setMessages([
          {
            id: 'system-init',
            sender: 'assistant',
            text: `✨ Resume loaded for **${resume.name}**! I'm ready to help you customize your CV. What would you like to edit?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setChatHistoryLoaded(true);
      }
    };
    
    loadHistory();
  }, [resume?.name, githubUsername, chatHistoryLoaded]);

  const applyContactField = async (field: keyof typeof contactDraft) => {
    if (!resume) return;
    const raw = contactDraft[field].trim();
    
    if (field === 'name') {
      const updatedResume: CommitCVResume = {
        ...resume,
        name: raw || resume.name,
        lastUpdated: Date.now(),
      };
      setResume(updatedResume);
      try {
        await persistResume(updatedResume);
      } catch {
        setErrorBanner('Failed to save name to Firestore.');
      }
      return;
    }
    
    const contact: ResumeContact = { ...(resume.contact || {}) };

    if (field === 'languages') {
      if (raw) {
        contact.languages = raw.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        delete contact.languages;
      }
    } else if (raw) {
      contact[field] = raw;
    } else {
      delete contact[field];
    }

    const updatedResume: CommitCVResume = {
      ...resume,
      contact: Object.keys(contact).length ? contact : undefined,
      lastUpdated: Date.now(),
    };
    setResume(updatedResume);
    try {
      await persistResume(updatedResume);
    } catch {
      setErrorBanner('Failed to save contact details to Firestore.');
    }
  };

  const handleRepoEnhancement = () => {
    if (!resume || !selectedRepoId) return;
    const project = resume.projects.find((p) => p.id === selectedRepoId);
    if (!project) return;

    if (repoAction === 'description') {
      handleSendMessage(
        `Improve and expand the description bullets for the project "${project.name}". Keep facts grounded in the existing tech stack (${project.techStack.join(', ') || 'unknown'}). Use Action + Technology + Result style with metrics where reasonable.`
      );
    } else {
      handleSendMessage(
        `Update the tech stack for project "${project.name}" based on its descriptions and repository context. Add missing but plausible technologies; remove generic filler. Current stack: ${project.techStack.join(', ') || 'none'}.`
      );
    }
  };
  
  const handleRepoToggle = async (repoId: string, shouldAdd: boolean) => {
    if (!resume) return;
    
    if (shouldAdd) {
      // Add repository to resume
      handleSendMessage(
        `Add the repository "${repoId}" to my resume projects. Analyze it and create a professional project entry with appropriate role, tech stack, and 3 description bullets following our standard format.`
      );
    } else {
      // Remove repository from resume
      const updatedProjects = resume.projects.filter(p => p.name !== repoId && p.id !== repoId);
      const updatedResume: CommitCVResume = {
        ...resume,
        projects: updatedProjects,
        lastUpdated: Date.now(),
      };
      setResume(updatedResume);
      try {
        await persistResume(updatedResume);
        // Update local repo list
        setAllUserRepos(prev => prev.map(r => 
          r.name === repoId ? { ...r, inResume: false } : r
        ));
      } catch {
        setErrorBanner('Failed to remove repository from Firestore.');
      }
    }
  };

  const triggerPrint = () => {
    if (!resume) return;
    const runPrint = () => window.print();
    if (activeTab !== 'preview') {
      setActiveTab('preview');
      requestAnimationFrame(() => setTimeout(runPrint, 100));
      return;
    }
    runPrint();
  };

  const handleReset = () => {
    setResume(null);
    setNewlyAddedSkills([]);
    setGithubUsername('');
    setMessages([]);
    setChatHistoryLoaded(false);
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
      <header className="no-print border-b border-slate-800 bg-slate-900/60 backdrop-blur-md relative z-10 sticky top-0 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CommitCV Logo" className="h-9 w-auto object-contain rounded-lg shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-cyan bg-clip-text text-transparent">CommitCV</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden md:block">"Every commit builds your career."</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!resume && (
              <button
                onClick={() => setShowTryItOutModal(true)}
                className="text-xs font-semibold text-white bg-gradient-to-r from-brand-purple to-brand-cyan hover:brightness-110 active:scale-95 transition-all duration-150 px-4 py-2 rounded-xl shadow-lg shadow-brand-purple/10 cursor-pointer flex items-center gap-1.5 font-mono uppercase tracking-wider"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Try It Out</span>
              </button>
            )}
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
        
        {/* Debug info - remove this later */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
            <div className="text-brand-cyan font-bold mb-1">Debug State:</div>
            <div className="text-slate-300">resume: {resume ? '✓ exists' : '✗ null'}</div>
            <div className="text-slate-300">loading: {loading ? 'true' : 'false'}</div>
            <div className="text-slate-300">analysisProgress: "{analysisProgress}"</div>
            <div className="text-slate-300">githubUsername: {githubUsername || 'null'}</div>
          </div>
        )}
        
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
          <div className="w-full flex flex-col items-center">
            {/* Debug log for rendering decision */}
            {(() => {
              console.log('==============================================');
              console.log('[RENDER DECISION] 🎨 Conditional check: !resume');
              console.log('[RENDER DECISION] - resume:', resume);
              console.log('[RENDER DECISION] - resume is falsy, showing LANDING PAGE');
              console.log('[RENDER DECISION] - loading:', loading);
              console.log('[RENDER DECISION] - publicScanLoading:', publicScanLoading);
              console.log('==============================================');
              return null;
            })()}
            {/* Section 1 - Hero */}
            <section className="scroll-section hero-section flex flex-col justify-center items-center relative min-h-screen text-center py-12 overflow-hidden w-full">
              {/* Contribution Graph background - using stable memoized cells */}
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none z-0">
                <div className="contribution-grid grid grid-rows-7 grid-flow-col gap-1.5 p-4 max-w-full rotate-[-12deg] scale-150">
                  {contributionCells.map((cell) => (
                    <div 
                      key={cell.id} 
                      className={`contribution-node level-${cell.level} contribution-node-cell`} 
                      data-index={cell.id}
                    />
                  ))}
                </div>
              </div>

              <div className="relative z-10 max-w-4xl px-4 flex flex-col items-center">
                <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3.5 py-1 bg-opacity-80 rounded-full text-xs font-mono text-slate-350 mb-6">
                  <Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
                  <span>Every Commit Becomes Career Evidence</span>
                </div>

                <h1 className="hero-title font-display font-bold text-5xl md:text-7xl text-white tracking-tight leading-none mb-6 max-w-3xl">
                  Your Resume Should <span className="bg-gradient-to-r from-brand-purple to-brand-cyan bg-clip-text text-transparent">Write Itself.</span>
                </h1>

                <p className="hero-subtitle text-slate-400 text-base md:text-xl mb-12 max-w-2xl leading-relaxed font-sans">
                  Keep building. CommitCV turns every repository, pull request and commit into career evidence automatically.
                </p>

                <div 
                  className="hero-scroll-indicator flex flex-col items-center gap-2.5 text-slate-500 font-mono text-xs cursor-pointer select-none transition-colors hover:text-slate-300"
                  onClick={() => {
                    document.querySelector('.problem-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span>Scroll to explore the journey</span>
                  <div className="w-6 h-10 border-2 border-slate-700 rounded-full flex justify-center p-1">
                    <div className="w-1.5 h-2 bg-brand-cyan rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2 - The Problem */}
            <section className="scroll-section problem-section min-h-screen flex items-center justify-center relative w-full bg-slate-950/80 border-t border-slate-900 py-16">
              <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
                
                {/* Left Side: Traditional Resume Skills */}
                <div className="problem-left flex flex-col gap-4">
                  <h3 className="font-mono text-xs uppercase text-slate-500 tracking-wider text-left">Traditional Resume Skills</h3>
                  <div className="flex flex-col gap-3.5 max-w-sm">
                    <div className="problem-skill flex items-center justify-between bg-slate-900 border border-amber-500/30 p-4 rounded-xl text-left shadow-lg shadow-amber-500/5 transition-all duration-500">
                      <span className="font-display font-bold text-white text-lg">Java</span>
                      <span className="font-mono text-xs text-amber-500">Expert, 5 Years</span>
                    </div>
                    <div className="problem-skill flex items-center justify-between bg-slate-900 border border-blue-500/30 p-4 rounded-xl text-left shadow-lg shadow-blue-500/5 transition-all duration-500">
                      <span className="font-display font-bold text-white text-lg">React</span>
                      <span className="font-mono text-xs text-blue-400 font-semibold">Expert, 4 Years</span>
                    </div>
                    <div className="problem-skill flex items-center justify-between bg-slate-900 border border-green-500/30 p-4 rounded-xl text-left shadow-lg shadow-green-500/5 transition-all duration-500">
                      <span className="font-display font-bold text-white text-lg">Node.js</span>
                      <span className="font-mono text-xs text-green-500 font-semibold">Advanced, 3 Years</span>
                    </div>
                    <div className="problem-skill flex items-center justify-between bg-slate-900 border border-cyan-500/30 p-4 rounded-xl text-left shadow-lg shadow-cyan-500/5 transition-all duration-500">
                      <span className="font-display font-bold text-white text-lg">Docker</span>
                      <span className="font-mono text-xs text-brand-cyan">Advanced, 2 Years</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: The Question */}
                <div className="problem-right flex flex-col justify-center text-left">
                  <div className="problem-question-container">
                    <h2 className="problem-question font-display font-bold text-4xl md:text-5xl text-red-550 text-red-500 tracking-tight leading-none mb-6">
                      Can you prove it?
                    </h2>
                    <div className="problem-answer opacity-0 translate-y-5">
                      <p className="text-xl text-white font-semibold leading-relaxed mb-4">
                        Anyone can write skills.
                      </p>
                      <p className="text-2xl bg-gradient-to-r from-brand-purple to-brand-cyan bg-clip-text text-transparent font-bold leading-relaxed">
                        Few can prove them.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* Section 3 - GitHub Connect */}
            <section className="scroll-section connect-section min-h-screen flex flex-col items-center justify-center relative w-full bg-slate-950 border-t border-slate-900 py-20">
              <div className="absolute inset-0 bg-radial-gradient from-brand-purple/5 to-transparent pointer-events-none" />

              {/* Outer Container */}
              <div className="relative z-10 max-w-5xl w-full mx-auto px-4 flex flex-col items-center justify-center text-center">
                
                <h2 className="connect-title font-display font-bold text-3xl md:text-5xl text-white mb-4">
                  Connect GitHub. Prove Your Work.
                </h2>
                <p className="connect-subtitle text-slate-400 text-sm md:text-base max-w-xl mb-12">
                  CommitCV digests your actual contributions in real-time, extracting skill evidence directly from repository history.
                </p>

                {/* The Central Engine Workspace */}
                <div className="relative w-full max-w-lg min-h-[350px] flex items-center justify-center my-4">
                  
                  {/* Central AI Engine Orb */}
                  <div className="ai-core-container absolute z-20 flex flex-col items-center justify-center">
                    <div className="ai-core w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-tr from-brand-purple to-brand-cyan flex items-center justify-center ai-core-glow relative transition-all duration-300">
                      
                      {/* Rotating outer rings */}
                      <div className="absolute inset-[-10px] rounded-full border border-dashed border-brand-purple/40 animate-rotate-slow pointer-events-none" />
                      <div className="absolute inset-[-20px] rounded-full border border-dotted border-brand-cyan/30 animate-rotate-reverse-slow pointer-events-none" />
                      
                      <div className="text-center p-3 select-none flex flex-col items-center">
                        <Cpu className="w-8 h-8 text-white mb-1 animate-pulse" />
                        <span className="font-display font-bold text-[10px] md:text-xs text-white uppercase tracking-widest leading-none">CommitCV</span>
                        <span className="font-mono text-[8px] text-cyan-200 mt-1 uppercase tracking-wider">AI Engine</span>
                      </div>
                    </div>
                  </div>

                  {/* Floating fly-in code blocks (will animate using GSAP) */}
                  <div className="connect-floating absolute left-[10%] top-[10%] bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs text-left shadow-lg max-w-[150px] pointer-events-none" style={{ transform: 'translateX(-300px)', opacity: 0 }}>
                    <div className="flex items-center gap-1.5 text-brand-cyan font-bold mb-1">
                      <Code className="w-3.5 h-3.5" />
                      <span className="font-mono text-[10px]">Repository</span>
                    </div>
                    <div className="font-mono font-bold text-[11px] text-white truncate">api-gateway</div>
                  </div>

                  <div className="connect-floating absolute right-[10%] top-[15%] bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs text-left shadow-lg max-w-[150px] pointer-events-none" style={{ transform: 'translateX(300px)', opacity: 0 }}>
                    <div className="flex items-center gap-1.5 text-brand-cyan font-bold mb-1">
                      <Code className="w-3.5 h-3.5" />
                      <span className="font-mono text-[10px]">Repository</span>
                    </div>
                    <div className="font-mono font-bold text-[11px] text-white truncate">react-app</div>
                  </div>

                  <div className="connect-floating absolute left-[15%] bottom-[20%] bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs text-left shadow-lg max-w-[160px] pointer-events-none" style={{ transform: 'translateX(-300px)', opacity: 0 }}>
                    <div className="flex items-center gap-1.5 text-rose-500 font-bold mb-1">
                      <GitCommit className="w-3.5 h-3.5" />
                      <span className="font-mono text-[10px]">Commit</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-300 italic truncate">"feat: add redis cache"</div>
                  </div>

                  <div className="connect-floating absolute right-[12%] bottom-[25%] bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs text-left shadow-lg max-w-[160px] pointer-events-none" style={{ transform: 'translateX(300px)', opacity: 0 }}>
                    <div className="flex items-center gap-1.5 text-blue-500 font-bold mb-1">
                      <GitPullRequest className="w-3.5 h-3.5" />
                      <span className="font-mono text-[10px]">PR Merged</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-300 truncate">#12 Docker Setup</div>
                  </div>

                </div>

                {/* Actual functional integration panel below the visuals */}
                <div className="connect-action-panel mt-8 w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-slate-300">
                  {/* Public Username Scan */}
                  <div className="bg-slate-900/60 border border-slate-800 hover:border-brand-cyan/40 transition rounded-xl p-6 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-brand-cyan">
                          <Code className="w-5 h-5" />
                        </div>
                        <span className="font-display font-semibold text-white">Public Username Scan</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-6">
                        Enter any public GitHub username (e.g. <code>gaearon</code>, <code>torvalds</code>) to build a resume without authentication.
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
                        className="w-full bg-brand-cyan hover:bg-cyan-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs cursor-pointer"
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

                  {/* Developer OAuth Sign-in */}
                  <div className="bg-slate-900/60 border border-slate-800 hover:border-brand-purple/40 transition rounded-xl p-6 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-brand-purple">
                            <Github className="w-5 h-5" />
                          </div>
                          <span className="font-display font-semibold text-white">Developer OAuth Sign-in</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-6">
                        Securely authorize CommitCV to read your personal repositories and private work to construct your evidence portfolio.
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


                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4 - AI Analysis */}
            <section className="scroll-section analysis-section min-h-screen flex items-center justify-center relative w-full bg-slate-950 border-t border-slate-900 py-20">
              <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
                
                {/* Left Column: Streaming Git Commits */}
                <div className="analysis-left flex flex-col justify-center text-left">
                  <h3 className="font-mono text-xs uppercase text-slate-500 tracking-wider mb-6">Git Commits Stream</h3>
                  <div className="flex flex-col gap-4 relative">
                    <div className="analysis-commit bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-xs text-slate-305 text-slate-300 opacity-20 flex items-center gap-3" data-commit="redis">
                      <GitCommit className="w-4 h-4 text-brand-purple shrink-0" />
                      <span>feat: add redis cache</span>
                    </div>
                    <div className="analysis-commit bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-xs text-slate-305 text-slate-300 opacity-20 flex items-center gap-3" data-commit="jwt">
                      <GitCommit className="w-4 h-4 text-brand-purple shrink-0" />
                      <span>fix: jwt authentication</span>
                    </div>
                    <div className="analysis-commit bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-xs text-slate-305 text-slate-300 opacity-20 flex items-center gap-3" data-commit="docker">
                      <GitCommit className="w-4 h-4 text-brand-purple shrink-0" />
                      <span>feat: docker deployment</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Extraction & Accumulating Score */}
                <div className="analysis-right flex flex-col justify-center text-left relative min-h-[300px]">
                  
                  {/* Skill extraction cards (hidden initially, fade in as commit is processed) */}
                  <div className="absolute inset-0 flex flex-col justify-center gap-4 z-10 pointer-events-none">
                    <div className="analysis-skill-tag absolute bg-brand-purple/20 border border-brand-purple text-violet-300 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 opacity-0 scale-50" style={{ left: '5%', top: '20%' }} data-skill="redis">
                      <span>Redis</span>
                      <span className="text-[10px] text-brand-cyan">+24pts</span>
                    </div>
                    <div className="analysis-skill-tag absolute bg-brand-purple/20 border border-brand-purple text-violet-300 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 opacity-0 scale-50" style={{ left: '35%', top: '35%' }} data-skill="jwt">
                      <span>JWT Auth</span>
                      <span className="text-[10px] text-brand-cyan">+18pts</span>
                    </div>
                    <div className="analysis-skill-tag absolute bg-brand-purple/20 border border-brand-purple text-violet-300 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 opacity-0 scale-50" style={{ left: '15%', top: '55%' }} data-skill="docker">
                      <span>Docker</span>
                      <span className="text-[10px] text-brand-cyan">+32pts</span>
                    </div>
                  </div>

                  {/* Profile Metrics Scorecard */}
                  <div className="analysis-scorecard bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm opacity-20 transition-opacity duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-4 h-4 text-brand-cyan" />
                      <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider">Skill Metrics Compiled</h4>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Backend */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-slate-400">Backend Engineering</span>
                          <span className="text-white font-bold font-mono">82%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                          <div className="analysis-progress-bar h-full bg-gradient-to-r from-brand-purple to-brand-cyan rounded-full" style={{ width: '0%' }} data-progress="82" />
                        </div>
                      </div>

                      {/* Frontend */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-slate-400">Frontend Engineering</span>
                          <span className="text-white font-bold font-mono">74%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                          <div className="analysis-progress-bar h-full bg-gradient-to-r from-brand-purple to-brand-cyan rounded-full" style={{ width: '0%' }} data-progress="74" />
                        </div>
                      </div>

                      {/* DevOps */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1.5">
                          <span className="text-slate-400">DevOps & Infrastructure</span>
                          <span className="text-white font-bold font-mono">58%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                          <div className="analysis-progress-bar h-full bg-gradient-to-r from-brand-purple to-brand-cyan rounded-full" style={{ width: '0%' }} data-progress="58" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Section 5 - Living Resume */}
            <section className="scroll-section living-resume-section min-h-screen flex items-center justify-center relative w-full bg-slate-950 border-t border-slate-900 py-20">
              <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full">
                
                {/* Left Column: GitHub Activity (5 cols) */}
                <div className="md:col-span-5 flex flex-col text-left">
                  <h3 className="font-mono text-xs uppercase text-slate-500 tracking-wider mb-6">GitHub Activity Stream</h3>
                  
                  <div className="space-y-4">
                    <div className="living-activity-item flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-3 rounded-lg opacity-40 transition-opacity duration-300" data-activity="docker">
                      <div className="w-8 h-8 rounded bg-cyan-500/20 text-brand-cyan flex items-center justify-center font-mono font-bold text-xs shrink-0">+</div>
                      <div>
                        <div className="text-xs font-bold text-white font-mono">push: main branch</div>
                        <div className="text-[10px] text-slate-400 font-mono">add Dockerfile & compose</div>
                      </div>
                    </div>

                    <div className="living-activity-item flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-3 rounded-lg opacity-40 transition-opacity duration-300" data-activity="redis">
                      <div className="w-8 h-8 rounded bg-brand-purple/20 text-brand-purple flex items-center justify-center font-mono font-bold text-xs shrink-0">+</div>
                      <div>
                        <div className="text-xs font-bold text-white font-mono">push: feat/cache</div>
                        <div className="text-[10px] text-slate-400 font-mono">configure redis client</div>
                      </div>
                    </div>

                    <div className="living-activity-item flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-3 rounded-lg opacity-40 transition-opacity duration-300" data-activity="cicd">
                      <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">+</div>
                      <div>
                        <div className="text-xs font-bold text-white font-mono">pull_request: merged</div>
                        <div className="text-[10px] text-slate-400 font-mono">setup GitHub Actions CI workflow</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Living Resume Preview (7 cols) */}
                <div className="md:col-span-7 flex flex-col bg-white text-slate-900 p-6 rounded-2xl shadow-2xl min-h-[350px] relative text-left font-sans">
                  <div className="border-b border-slate-200 pb-3 mb-4">
                    <h4 className="font-display font-bold text-lg text-slate-900">Alex Builder</h4>
                    <span className="font-mono text-[10px] text-violet-750 text-violet-700 font-bold uppercase tracking-wider">Full Stack Engineer</span>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-2">Technical Skills</span>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-mono bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded">React</span>
                        <span className="text-xs font-mono bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded">Node.js</span>
                        <span className="text-xs font-mono bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded">TypeScript</span>
                        
                        {/* Dynamic Skills */}
                        <span className="living-resume-skill text-xs font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded opacity-0 scale-50 transition-all duration-300" data-resume-skill="docker">Docker</span>
                        <span className="living-resume-skill text-xs font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded opacity-0 scale-50 transition-all duration-300" data-resume-skill="redis">Redis</span>
                        <span className="living-resume-skill text-xs font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1 rounded opacity-0 scale-50 transition-all duration-300" data-resume-skill="cicd">CI/CD</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1.5">Highlighted Experience</span>
                      <div className="space-y-2">
                        <div className="font-sans text-xs text-slate-700 leading-relaxed">
                          • Developed scalable microservices architecture; containerized workflows using <strong className="living-experience-highlight text-emerald-700 opacity-20 transition-opacity duration-300" data-highlight="docker">Docker</strong>.
                        </div>
                        <div className="font-sans text-xs text-slate-700 leading-relaxed">
                          • Implemented high-throughput database caching using <strong className="living-experience-highlight text-emerald-700 opacity-20 transition-opacity duration-300" data-highlight="redis">Redis</strong>.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                    <span>⚡ Auto updated via git-push webhook</span>
                    <span className="text-brand-purple font-bold">100% Verified Evidence</span>
                  </div>
                </div>

              </div>
            </section>

            {/* Section 6 - AI Career Coach */}
            <section className="scroll-section career-coach-section min-h-screen flex items-center justify-center relative w-full bg-slate-950 border-t border-slate-900 py-20 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/10 via-slate-950 to-slate-950 pointer-events-none" />
              
              <div className="max-w-6xl mx-auto px-4 w-full relative z-10">
                
                {/* Section Header */}
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full text-xs font-mono text-amber-400 mb-4">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>AI-Powered Career Intelligence</span>
                  </div>
                  <h2 className="coach-title font-display font-bold text-4xl md:text-6xl text-white mb-4 tracking-tight">
                    Your <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Career Advisor</span> Awaits
                  </h2>
                  <p className="coach-subtitle text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                    AI analyzes your GitHub trajectory, skill patterns, and project depth to guide your next 10 years.
                  </p>
                </div>

                {/* Career Paths Grid - Cards slide in from left */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                  
                  {/* Backend Engineering Path */}
                  <div className="career-path-card group cursor-pointer opacity-0" data-path="backend" style={{ transform: 'translateX(-100px)' }}>
                    <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10 h-full flex flex-col">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Database className="w-7 h-7 text-blue-400" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">Backend Engineering</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                        Master distributed systems, database optimization, API design, and microservices architecture.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Go</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">PostgreSQL</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Redis</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">gRPC</span>
                      </div>
                    </div>
                  </div>

                  {/* Frontend Engineering Path */}
                  <div className="career-path-card group cursor-pointer opacity-0" data-path="frontend" style={{ transform: 'translateX(-100px)' }}>
                    <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10 h-full flex flex-col">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Code className="w-7 h-7 text-purple-400" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">Frontend Engineering</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                        Build responsive UIs, performance optimization, component architecture, and modern frameworks.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">React</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">TypeScript</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Next.js</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Tailwind</span>
                      </div>
                    </div>
                  </div>

                  {/* DevOps/SRE Path */}
                  <div className="career-path-card group cursor-pointer opacity-0" data-path="devops" style={{ transform: 'translateX(-100px)' }}>
                    <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10 h-full flex flex-col">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Terminal className="w-7 h-7 text-emerald-400" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">DevOps & SRE</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                        Infrastructure as code, CI/CD pipelines, container orchestration, and system reliability.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Kubernetes</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Docker</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Terraform</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">AWS</span>
                      </div>
                    </div>
                  </div>

                  {/* Machine Learning Path */}
                  <div className="career-path-card group cursor-pointer opacity-0" data-path="ml" style={{ transform: 'translateX(-100px)' }}>
                    <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10 h-full flex flex-col">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <BrainCircuit className="w-7 h-7 text-orange-400" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">Machine Learning</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                        Deep learning, model training, data pipelines, and production ML infrastructure.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Python</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">PyTorch</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">TensorFlow</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">MLflow</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Development Path */}
                  <div className="career-path-card group cursor-pointer opacity-0" data-path="mobile" style={{ transform: 'translateX(-100px)' }}>
                    <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10 h-full flex flex-col">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-7 h-7 text-indigo-400" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">Mobile Development</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                        Native and cross-platform apps, responsive design, offline-first architecture.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">React Native</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Swift</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Kotlin</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Flutter</span>
                      </div>
                    </div>
                  </div>

                  {/* Security Engineering Path */}
                  <div className="career-path-card group cursor-pointer opacity-0" data-path="security" style={{ transform: 'translateX(-100px)' }}>
                    <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10 h-full flex flex-col">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShieldAlert className="w-7 h-7 text-red-400" />
                      </div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-amber-400 transition-colors">Security Engineering</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                        Threat modeling, secure architecture, penetration testing, and compliance.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">OWASP</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Auth</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">Cryptography</span>
                        <span className="text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">ZeroTrust</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* CTA Section */}
                <div className="coach-cta text-center opacity-0" style={{ transform: 'translateY(30px)' }}>
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-8 max-w-3xl mx-auto">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Compass className="w-8 h-8 text-amber-500" />
                      <h3 className="font-display font-bold text-2xl text-white">Meet Alistair "The Vet" Vance</h3>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-2xl mx-auto">
                      A semi-retired Principal Architect who's seen it all since the early 90s. Gruff, wise, and deeply caring about your long-term career trajectory. He speaks up only when it matters—and analyzes your GitHub data to guide your next decade.
                    </p>
                    <button
                      onClick={() => {
                        if (!resume) {
                          setShowTryItOutModal(true);
                        }
                      }}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-bold text-sm px-8 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-950/40 mx-auto"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>Start Your Career Analysis</span>
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* Privacy note */}
            <div className="flex items-start gap-2 max-w-md mx-auto text-xs text-slate-500 bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 text-left my-12 relative z-10">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Note:</strong> CommitCV retrieves profile activity in secure volatile memory. We do not store your private source code.
              </span>
            </div>

          </div>
        ) : (
          /* Step 2, 3, 4: Main Resume workspace */
          <div className="flex flex-col gap-6 flex-1" data-section="portfolio">
            {/* Debug log for resume workspace */}
            {(() => {
              console.log('==============================================');
              console.log('[RENDER DECISION] 🎨 Conditional check: resume exists');
              console.log('[RENDER DECISION] - resume:', !!resume);
              console.log('[RENDER DECISION] - resume.name:', resume?.name);
              console.log('[RENDER DECISION] - Showing RESUME WORKSPACE');
              console.log('[RENDER DECISION] - loading:', loading);
              console.log('[RENDER DECISION] - analysisProgress:', analysisProgress);
              console.log('==============================================');
              return null;
            })()}
            {/* Analysis Progress Indicator */}
            {(loading || analysisProgress) && (
              <div className="bg-slate-900/80 border border-brand-cyan/50 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-brand-cyan animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">Analyzing GitHub Profile</p>
                    <p className="text-xs text-slate-400 font-mono">{analysisProgress || 'Processing...'}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Beautiful Navigation Tabs inside Dashboard Workspace */}
            <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-3">
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

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>Active Profile Context: <strong className="text-slate-300">@{githubUsername || (resume && resume.name) || "scanned_developer"}</strong></span>
                </div>
                
                {/* Real-time Webhook Status & Setup Button */}
                {isAuthenticated && githubToken && (
                  <div className="flex items-center gap-2">
                    {webhookEnabled ? (
                      <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/50 rounded-lg px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[11px] text-emerald-400 font-semibold">Live Updates Enabled</span>
                        </div>
                        {webhookStatus && (
                          <span className="text-[10px] text-emerald-300/70 font-mono">
                            {webhookStatus.reposWithWebhook}/{webhookStatus.totalRepos} repos
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowWebhookModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Enable Live Updates</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {currentView === 'coach' ? (
              <AICareerCoach 
                currentResume={resume} 
                username={githubUsername || (resume && resume.name) || "scanned_username"}
                isAuthenticated={isAuthenticated}
                onRequestAuth={handleGithubConnect}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
            
            {/* LEFT COLUMN: CHAT COPILOT ONLY (5 cols) */}
            <div className="no-print lg:col-span-5 flex flex-col">
              
              {/* Resume Chat Copilot - Pristine layout taking full height */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex-1 flex flex-col relative overflow-hidden min-h-[700px]">
                
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-purple animate-pulse" />
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">AI Resume Chat Co-pilot</h3>
                      <p className="text-[10px] text-slate-400">Instruct Gemini to adjust your CV instantly</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingChat && (
                      <span className="text-[9px] text-brand-cyan font-mono flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                    <button
                      onClick={clearChatHistory}
                      className="text-[10px] bg-slate-950 hover:bg-red-950/30 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-400 px-2 py-1 rounded transition"
                      title="Clear chat history"
                    >
                      Clear
                    </button>
                    <span className="bg-slate-950 text-slate-400 font-mono text-[10px] px-2.5 py-0.5 rounded border border-slate-800">
                      Online
                    </span>
                  </div>
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px] mb-4 text-left">
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
                <div className="mb-4 space-y-3">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider text-left">Quick tuning</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setShowContactDetails(!showContactDetails)}
                      className={`text-[10px] ${showContactDetails ? 'bg-brand-purple/30 border-brand-purple text-violet-200' : 'bg-slate-950 border-slate-800 text-slate-300'} hover:bg-slate-800 border hover:border-slate-700 py-1 px-3 rounded-lg transition text-left`}
                    >
                      📝 Contact Details
                    </button>
                    <button
                      onClick={() => setShowRepoActions(!showRepoActions)}
                      className={`text-[10px] ${showRepoActions ? 'bg-brand-purple/30 border-brand-purple text-violet-200' : 'bg-slate-950 border-slate-800 text-slate-300'} hover:bg-slate-800 border hover:border-slate-700 py-1 px-3 rounded-lg transition text-left`}
                    >
                      🗂️ Repository Actions
                    </button>
                    <button
                      onClick={() => setShowOpenSource(!showOpenSource)}
                      className={`text-[10px] ${showOpenSource ? 'bg-brand-purple/30 border-brand-purple text-violet-200' : 'bg-slate-950 border-slate-800 text-slate-300'} hover:bg-slate-800 border hover:border-slate-700 py-1 px-3 rounded-lg transition text-left`}
                    >
                      🌟 Open Source Contributor
                    </button>
                    <button
                      onClick={() => setShowSocialMedia(!showSocialMedia)}
                      className={`text-[10px] ${showSocialMedia ? 'bg-brand-purple/30 border-brand-purple text-violet-200' : 'bg-slate-950 border-slate-800 text-slate-300'} hover:bg-slate-800 border hover:border-slate-700 py-1 px-3 rounded-lg transition text-left`}
                    >
                      🔗 Social Media
                    </button>
                    <button
                      onClick={() => setShowFontSettings(!showFontSettings)}
                      className={`text-[10px] ${showFontSettings ? 'bg-brand-purple/30 border-brand-purple text-violet-200' : 'bg-slate-950 border-slate-800 text-slate-300'} hover:bg-slate-800 border hover:border-slate-700 py-1 px-3 rounded-lg transition text-left`}
                    >
                      🔤 Font Settings
                    </button>
                    <button
                      onClick={() => setShowTechStackManager(!showTechStackManager)}
                      className={`text-[10px] ${showTechStackManager ? 'bg-brand-purple/30 border-brand-purple text-violet-200' : 'bg-slate-950 border-slate-800 text-slate-300'} hover:bg-slate-800 border hover:border-slate-700 py-1 px-3 rounded-lg transition text-left`}
                    >
                      🏷️ Manage Tech Stack
                    </button>
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
                      Target Senior Backend
                    </button>
                    <button
                      onClick={() => handleSendMessage("Highlight my open-source contribution and impact stats inside the CV layout")}
                      className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1 px-3 rounded-lg text-slate-300 transition text-left"
                    >
                      Focus Open Source
                    </button>
                  </div>

                  {/* Contact Details Section - Collapsible */}
                  {showContactDetails && (
                    <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 animate-fadeIn">
                      <p className="text-[10px] font-mono text-brand-cyan uppercase tracking-wider">Edit Contact Information</p>
                      {([
                        { field: 'name' as const, label: 'Name', placeholder: 'Your full name' },
                        { field: 'location' as const, label: 'Location', placeholder: 'e.g. Seattle, WA' },
                        { field: 'email' as const, label: 'Email', placeholder: 'you@email.com' },
                        { field: 'age' as const, label: 'Age', placeholder: 'e.g. 22' },
                        { field: 'languages' as const, label: 'Languages', placeholder: 'English, Mandarin' },
                      ]).map(({ field, placeholder }) => (
                        <div key={field} className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            {field.charAt(0).toUpperCase() + field.slice(1)}
                          </label>
                          <input
                            type="text"
                            value={contactDraft[field]}
                            onChange={(e) => setContactDraft((d) => ({ ...d, [field]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-purple"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          // Build a natural language message from the contact fields
                          const updates: string[] = [];
                          if (contactDraft.name && contactDraft.name !== resume?.name) {
                            updates.push(`name to "${contactDraft.name}"`);
                          }
                          if (contactDraft.location && contactDraft.location !== resume?.contact?.location) {
                            updates.push(`location to "${contactDraft.location}"`);
                          }
                          if (contactDraft.email && contactDraft.email !== resume?.contact?.email) {
                            updates.push(`email to "${contactDraft.email}"`);
                          }
                          if (contactDraft.age && contactDraft.age !== resume?.contact?.age) {
                            updates.push(`age to "${contactDraft.age}"`);
                          }
                          const currentLanguages = resume?.contact?.languages?.join(', ') || '';
                          if (contactDraft.languages && contactDraft.languages !== currentLanguages) {
                            updates.push(`spoken languages to "${contactDraft.languages}"`);
                          }
                          
                          if (updates.length === 0) {
                            handleSendMessage('Update my contact information with the details I provided');
                          } else {
                            handleSendMessage(`Update my ${updates.join(', ')}`);
                          }
                        }}
                        disabled={isChatLoading}
                        className="w-full mt-2 bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/40 text-violet-200 font-semibold text-[11px] py-2 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isChatLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Applying...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Apply Contact Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Repository Actions Section - Collapsible */}
                  {showRepoActions && (
                    <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 animate-fadeIn">
                      <p className="text-[10px] font-mono text-brand-cyan uppercase tracking-wider">Repository Management</p>
                      
                      {/* Repository List with Toggle */}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {allUserRepos.map((repo) => (
                          <div key={repo.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                            <span className={`text-[10px] font-mono ${repo.inResume ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {repo.inResume && '✓ '}{repo.name}
                            </span>
                            <button
                              onClick={() => handleRepoToggle(repo.name, !repo.inResume)}
                              className={`text-[9px] px-2 py-0.5 rounded ${
                                repo.inResume 
                                  ? 'bg-red-900/30 border border-red-800 text-red-300 hover:bg-red-900/50' 
                                  : 'bg-emerald-900/30 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/50'
                              } transition`}
                            >
                              {repo.inResume ? 'Remove' : 'Add'}
                            </button>
                          </div>
                        ))}
                        {allUserRepos.length === 0 && (
                          <p className="text-[10px] text-slate-500 italic">Loading repositories...</p>
                        )}
                      </div>

                      {/* Enhance existing project */}
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <p className="text-[9px] font-mono text-slate-500 uppercase">Enhance Existing Project</p>
                        <select
                          value={selectedRepoId}
                          onChange={(e) => setSelectedRepoId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-brand-purple"
                        >
                          {resume?.projects?.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <div className="flex gap-1.5">
                          <select
                            value={repoAction}
                            onChange={(e) => setRepoAction(e.target.value as 'description' | 'tech-stack')}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-brand-purple"
                          >
                            <option value="description">Enhance project description</option>
                            <option value="tech-stack">Update project tech stack</option>
                          </select>
                          <button
                            onClick={handleRepoEnhancement}
                            disabled={isChatLoading || !selectedRepoId}
                            className="shrink-0 text-[10px] bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/40 text-violet-200 px-3 rounded-lg transition disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Social Media Section - Collapsible */}
                  {showSocialMedia && (
                    <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 animate-fadeIn">
                      <p className="text-[10px] font-mono text-brand-cyan uppercase tracking-wider">Social Media Links</p>
                      {([
                        { field: 'linkedin' as const, label: 'LinkedIn', placeholder: 'linkedin.com/in/yourprofile' },
                        { field: 'twitter' as const, label: 'Twitter/X', placeholder: 'twitter.com/yourhandle' },
                        { field: 'instagram' as const, label: 'Instagram', placeholder: 'instagram.com/yourhandle' },
                        { field: 'facebook' as const, label: 'Facebook', placeholder: 'facebook.com/yourprofile' },
                      ]).map(({ field, label, placeholder }) => (
                        <div key={field} className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={socialMediaDraft[field]}
                            onChange={(e) => setSocialMediaDraft((d) => ({ ...d, [field]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-purple"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const updates: string[] = [];
                          if (socialMediaDraft.linkedin && socialMediaDraft.linkedin !== resume?.contact?.linkedin) {
                            updates.push(`LinkedIn to "${socialMediaDraft.linkedin}"`);
                          }
                          if (socialMediaDraft.twitter && socialMediaDraft.twitter !== resume?.contact?.twitter) {
                            updates.push(`Twitter to "${socialMediaDraft.twitter}"`);
                          }
                          if (socialMediaDraft.instagram && socialMediaDraft.instagram !== resume?.contact?.instagram) {
                            updates.push(`Instagram to "${socialMediaDraft.instagram}"`);
                          }
                          if (socialMediaDraft.facebook && socialMediaDraft.facebook !== resume?.contact?.facebook) {
                            updates.push(`Facebook to "${socialMediaDraft.facebook}"`);
                          }
                          
                          if (updates.length === 0) {
                            handleSendMessage('Update my social media links with the provided information');
                          } else {
                            handleSendMessage(`Update my social media: ${updates.join(', ')}`);
                          }
                        }}
                        disabled={isChatLoading}
                        className="w-full mt-2 bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/40 text-violet-200 font-semibold text-[11px] py-2 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isChatLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Applying...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Apply Social Media Links</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Font Settings Section - Collapsible */}
                  {showFontSettings && (
                    <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 animate-fadeIn">
                      <p className="text-[10px] font-mono text-brand-cyan uppercase tracking-wider">Resume Font Settings</p>
                      
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            Font Size
                          </label>
                          <select
                            value={resume?.fontSize || '11pt'}
                            onChange={(e) => {
                              const newSize = e.target.value as '10pt' | '11pt' | '12pt';
                              const updatedResume = {
                                ...resume!,
                                fontSize: newSize,
                                lastUpdated: Date.now(),
                              };
                              setResume(updatedResume);
                              persistResume(updatedResume);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-brand-purple"
                          >
                            <option value="10pt">10pt (Compact)</option>
                            <option value="11pt">11pt (Standard)</option>
                            <option value="12pt">12pt (Large)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            Font Family
                          </label>
                          <select
                            value={resume?.fontFamily || 'Georgia'}
                            onChange={(e) => {
                              const newFont = e.target.value as 'Georgia' | 'Times New Roman' | 'Arial' | 'Helvetica' | 'Calibri';
                              const updatedResume = {
                                ...resume!,
                                fontFamily: newFont,
                                lastUpdated: Date.now(),
                              };
                              setResume(updatedResume);
                              persistResume(updatedResume);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-brand-purple"
                          >
                            <option value="Georgia">Georgia (Classic Serif)</option>
                            <option value="Times New Roman">Times New Roman (Traditional)</option>
                            <option value="Arial">Arial (Modern Sans-serif)</option>
                            <option value="Helvetica">Helvetica (Clean Sans-serif)</option>
                            <option value="Calibri">Calibri (Professional Sans-serif)</option>
                          </select>
                        </div>

                        <div className="mt-2 bg-slate-900 border border-slate-800 rounded-lg p-2">
                          <p className="text-[9px] text-slate-400 leading-relaxed">
                            Current: <span className="text-brand-cyan font-semibold">{resume?.fontFamily || 'Georgia'}</span> at <span className="text-brand-cyan font-semibold">{resume?.fontSize || '11pt'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tech Stack Manager Section - Collapsible */}
                  {showTechStackManager && (
                    <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 animate-fadeIn">
                      <p className="text-[10px] font-mono text-brand-cyan uppercase tracking-wider">Add Tech Stack Badge</p>
                      
                      <div className="space-y-2">
                        {/* Category Selector */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            Category
                          </label>
                          <select
                            value={techStackCategory}
                            onChange={(e) => setTechStackCategory(e.target.value as typeof techStackCategory)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-brand-purple"
                          >
                            <option value="languages">Languages</option>
                            <option value="frameworks">Frameworks</option>
                            <option value="databases">Databases</option>
                            <option value="tools">Tools</option>
                          </select>
                        </div>

                        {/* Display Current Skills in Category */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">
                            Current {techStackCategory}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {resume?.skills?.[techStackCategory]?.length > 0 ? (
                              resume.skills[techStackCategory].map((skill: string) => (
                                <span
                                  key={skill}
                                  className="text-[9px] bg-slate-950 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono"
                                >
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] text-slate-500 italic">None yet</span>
                            )}
                          </div>
                        </div>

                        {/* Dropdown with All Skills + Custom Input */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            Select or Add New
                          </label>
                          
                          {/* Combo: Dropdown for existing + Input for custom */}
                          <div className="flex gap-1.5">
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleSendMessage(
                                    `Add "${e.target.value}" to my ${techStackCategory} skills if it's not already there`
                                  );
                                  e.target.value = ''; // Reset dropdown
                                }
                              }}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 focus:outline-none focus:border-brand-purple"
                            >
                              <option value="">Select existing...</option>
                              {resume?.allSkills?.[techStackCategory]?.length > 0 ? (
                                resume.allSkills[techStackCategory]
                                  .filter((skill: string) => !resume.skills[techStackCategory]?.includes(skill))
                                  .map((skill: string) => (
                                    <option key={skill} value={skill}>
                                      {skill}
                                    </option>
                                  ))
                              ) : (
                                <option value="" disabled>
                                  No other skills detected
                                </option>
                              )}
                            </select>
                          </div>

                          <div className="flex gap-1.5 mt-1">
                            <input
                              type="text"
                              value={customTechInput}
                              onChange={(e) => setCustomTechInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && customTechInput.trim()) {
                                  handleSendMessage(
                                    `Add "${customTechInput.trim()}" to my ${techStackCategory} skills`
                                  );
                                  setCustomTechInput('');
                                }
                              }}
                              placeholder="Or type custom skill..."
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] py-1.5 px-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-purple"
                            />
                            <button
                              onClick={() => {
                                if (customTechInput.trim()) {
                                  handleSendMessage(
                                    `Add "${customTechInput.trim()}" to my ${techStackCategory} skills`
                                  );
                                  setCustomTechInput('');
                                }
                              }}
                              disabled={!customTechInput.trim()}
                              className="shrink-0 text-[10px] bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/40 text-violet-200 px-3 rounded-lg transition disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Helper Text */}
                        <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-2">
                          <p className="text-[9px] text-slate-400 leading-relaxed">
                            💡 <strong>Tip:</strong> Select from detected skills or add custom ones. AI will intelligently add them to your resume.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

            </div>


            {/* RIGHT COLUMN: LIVING RESUME VIEW (7 cols) */}
            <div className="lg:col-span-7 flex flex-col bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative print:border-0 print:shadow-none print:bg-white print:overflow-visible">
              
              {/* Doc header bar */}
              <div className="no-print flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/90 relative z-10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-purple" />
                  <span className="font-display font-bold text-xs text-white uppercase tracking-wider">Living CV Portfolio</span>
                  <div className="h-4 w-[1px] bg-slate-800" />
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-brand-cyan" />
                    Last Updated: {typeof resume.lastUpdated === 'number' ? getRelativeTime(resume.lastUpdated) : resume.lastUpdated || 'Just now'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Share Link Button */}
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/${githubUsername || resume?.name || ''}`;
                      navigator.clipboard.writeText(shareUrl);
                      setClipboardCopied(true);
                      setTimeout(() => setClipboardCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan text-[11px] font-semibold py-1.5 px-3 rounded-lg transition"
                  >
                    {clipboardCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>Share Link</span>
                      </>
                    )}
                  </button>

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
              </div>

              {/* Resume Format Selector */}
              <div className="no-print px-5 py-4 bg-slate-900/60 border-b border-slate-800 relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutTemplate className="w-4 h-4 text-brand-cyan" />
                  <span className="text-xs font-display font-bold text-white uppercase tracking-wider">
                    Resume Format
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mb-3">
                  {getResumeFormatOption(selectedFormat).description}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {RESUME_FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => handleFormatChange(format.id)}
                      className={`shrink-0 text-left rounded-xl border px-3 py-2.5 transition min-w-[140px] max-w-[180px] cursor-pointer ${
                        selectedFormat === format.id
                          ? 'border-brand-cyan bg-brand-cyan/10 shadow-lg shadow-brand-cyan/10'
                          : 'border-slate-700 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900'
                      }`}
                    >
                      <p className="text-[11px] font-display font-bold text-white leading-tight">
                        {format.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions strip */}
              <div className="no-print px-5 py-2.5 bg-slate-800/30 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
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


              {/* Resume Sheet Body — only this section is exported to PDF */}
              <div
                id="resume-print-area"
                className="resume-print-area flex-1 p-6 md:p-8 overflow-y-auto max-h-[720px] bg-white text-slate-900"
              >
                
                {activeTab === 'json' ? (
                  <pre className="font-mono text-xs bg-slate-950 text-slate-300 p-4 rounded-xl border border-slate-800 overflow-x-auto text-left selection:bg-brand-purple/40">
                    {JSON.stringify(resume, null, 2)}
                  </pre>
                ) : (
                  <ResumePreview
                    resume={resume}
                    formatId={selectedFormat}
                    username={githubUsername}
                    newlyAddedSkills={newlyAddedSkills}
                    showOpenSource={showOpenSource}
                  />
                )}

              </div>


            </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* Styled clean footer */}
      <footer className="no-print border-t border-slate-800 bg-slate-1000 relative z-10 py-5 text-center mt-auto px-4">
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

      {/* Try It Out Modal Popup */}
      {showTryItOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            onClick={() => setShowTryItOutModal(false)}
          />
          
          {/* Modal Container */}
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl z-10 animate-scaleIn">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowTryItOutModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition bg-slate-800 hover:bg-slate-700 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer border-none text-sm font-bold"
            >
              ✕
            </button>

            <div className="text-center mb-8">
              <h3 className="font-display font-bold text-2xl md:text-3xl text-white mb-2">
                Connect GitHub & Build Your Living CV
              </h3>
              <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto font-sans">
                Scan your profile directly or sign in securely to extract verified experience evidence from your code commits.
              </p>
            </div>

            {/* Connection Cards Layout (as in photo) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
              
              {/* Public Username Scan */}
              <div className="bg-slate-950 border border-slate-850 hover:border-brand-cyan/40 transition rounded-2xl p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-brand-cyan">
                      <Code className="w-5 h-5" />
                    </div>
                    <span className="font-display font-semibold text-lg text-white">Public Username Scan</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6 font-sans">
                    Enter any public GitHub username (e.g. <code>baifan1366</code>, <code>torvalds</code>) to build a resume without authentication.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && githubUsername.trim()) {
                        await triggerAnalysis(null, githubUsername);
                      }
                    }}
                    placeholder="Enter GitHub username (e.g. gaearon)"
                    className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 p-3 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-cyan transition"
                  />
                  <button
                    onClick={async () => {
                      console.log('==============================================');
                      console.log('[PUBLIC SCAN BUTTON] 🔵 Button clicked!');
                      console.log('[PUBLIC SCAN BUTTON] Username input:', githubUsername);
                      console.log('[PUBLIC SCAN BUTTON] Current resume state:', !!resume);
                      console.log('==============================================');
                      
                      setPublicScanLoading(true);
                      console.log('[PUBLIC SCAN BUTTON] publicScanLoading set to TRUE');
                      
                      console.log('[PUBLIC SCAN BUTTON] Calling triggerAnalysis...');
                      await triggerAnalysis(null, githubUsername);
                      console.log('[PUBLIC SCAN BUTTON] triggerAnalysis completed');
                      console.log('==============================================');
                    }}
                    disabled={publicScanLoading || !githubUsername.trim()}
                    className="w-full bg-brand-cyan hover:bg-cyan-500 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {publicScanLoading ? (
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

              {/* Developer OAuth Sign-in */}
              <div className="bg-slate-950 border border-slate-850 hover:border-brand-purple/40 transition rounded-2xl p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-brand-purple">
                      <Github className="w-5 h-5" />
                    </div>
                    <span className="font-display font-semibold text-lg text-white">Developer OAuth Sign-in</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6 font-sans">
                    Securely authorize CommitCV to read your personal repositories and private work to construct your evidence portfolio.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      await handleGithubConnect();
                    }}
                    disabled={oauthLoading}
                    className="w-full bg-slate-100 hover:bg-white text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {oauthLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Github className="w-4 h-4" />
                        Sign in with GitHub
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Setup Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" 
            onClick={() => setShowWebhookModal(false)}
          />
          
          {/* Modal Container */}
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full shadow-2xl z-10 animate-scaleIn">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowWebhookModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition bg-slate-800 hover:bg-slate-700 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer border-none text-sm font-bold"
            >
              ✕
            </button>

            {/* Header with Icon */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-display font-bold text-3xl text-white mb-3 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Enable Live Resume Updates
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Automatically configure Webhooks for all your GitHub repositories. Every time you push code, AI will analyze your commits and update your resume!
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                <GitCommit className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-white mb-1">Auto Analysis</h4>
                <p className="text-[10px] text-slate-400">AI analyzes every commit message</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                <RefreshCw className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-white mb-1">Real-time Updates</h4>
                <p className="text-[10px] text-slate-400">Resume updates instantly after push</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-white mb-1">Auto Configuration</h4>
                <p className="text-[10px] text-slate-400">One-click setup for all repos</p>
              </div>
            </div>

            {/* Current Status (if webhook already partially enabled) */}
            {webhookStatus && webhookStatus.reposWithWebhook > 0 && (
              <div className="mb-6 p-4 bg-emerald-950/20 border border-emerald-800/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Partially Enabled</span>
                </div>
                <p className="text-xs text-emerald-300/70">
                  Currently {webhookStatus.reposWithWebhook} / {webhookStatus.totalRepos} repositories have Webhooks configured ({webhookStatus.coverage}%)
                </p>
              </div>
            )}

            {/* How it Works */}
            <div className="mb-8 p-5 bg-slate-950/50 border border-slate-800 rounded-xl">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-purple-400">⚡</span> How It Works
              </h4>
              <ol className="space-y-2 text-xs text-slate-300">
                <li className="flex gap-2">
                  <span className="text-purple-400 font-bold">1.</span>
                  <span>We automatically create a GitHub Webhook for each of your repositories</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-bold">2.</span>
                  <span>Every time you push code, GitHub notifies our AI server</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>AI analyzes your commits, extracts new skills and automatically updates your resume</span>
                </li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowWebhookModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-xl transition text-sm"
              >
                Maybe Later
              </button>
              <button
                onClick={setupWebhooks}
                disabled={settingUpWebhook}
                className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {settingUpWebhook ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enable Now
                  </>
                )}
              </button>
            </div>

            {/* Security Note */}
            <div className="mt-6 p-3 bg-slate-900/50 border border-slate-800/50 rounded-lg">
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                🔒 <strong>Security Note</strong>: Webhooks only receive push event notifications and will not access your code content. You can disable them anytime in your GitHub repository settings.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
