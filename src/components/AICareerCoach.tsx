/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  AlertTriangle, 
  Compass, 
  ShieldAlert, 
  Send, 
  RefreshCw, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  History,
  CheckCircle,
  HelpCircle,
  Clock,
  Lock,
  Github
} from 'lucide-react';
import { CommitCVResume, CoachInsights, CoachMessage } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs, deleteDoc } from 'firebase/firestore';

interface AICareerCoachProps {
  currentResume: CommitCVResume;
  username: string;
  isAuthenticated: boolean;
  onRequestAuth: () => void;
}

export default function AICareerCoach({ currentResume, username, isAuthenticated, onRequestAuth }: AICareerCoachProps) {
  const [insights, setInsights] = useState<CoachInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [savingChat, setSavingChat] = useState<boolean>(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState<boolean>(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Load chat history from Firestore
  const loadChatHistory = async () => {
    if (!username || !db) return;
    const cleanUsernameLower = username.trim().replace(/@/g, '').toLowerCase();
    
    try {
      const chatHistoryRef = collection(db, 'resumes', cleanUsernameLower, 'coachChat');
      const chatQuery = query(chatHistoryRef, orderBy('timestamp', 'asc'));
      const chatDocs = await getDocs(chatQuery);
      
      const loadedMessages: CoachMessage[] = [];
      chatDocs.forEach((docSnap) => {
        loadedMessages.push(docSnap.data() as CoachMessage);
      });
      
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
        console.log(`Loaded ${loadedMessages.length} coach chat messages from Firestore`);
      }
    } catch (err) {
      console.error('Failed to load coach chat history:', err);
    }
  };

  // Save chat history to Firestore
  const saveChatHistory = async (chatMessages: CoachMessage[]) => {
    if (!username || !db) return;
    const cleanUsernameLower = username.trim().replace(/@/g, '').toLowerCase();
    
    setSavingChat(true);
    try {
      const chatHistoryRef = collection(db, 'resumes', cleanUsernameLower, 'coachChat');
      
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
      
      console.log(`Saved ${chatMessages.length} coach chat messages to Firestore`);
    } catch (err) {
      console.error('Failed to save coach chat history:', err);
    } finally {
      setSavingChat(false);
    }
  };

  // Load insights on mount or when resume changes
  const fetchInsights = async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cleanUsernameLower = username.toLowerCase();

      // Check Firestore cache first
      if (!forceRefresh && db) {
        try {
          const insightsDocRef = doc(db, 'resumes', cleanUsernameLower, 'coachInsights', 'latest');
          const insightsDoc = await getDoc(insightsDocRef);
          
          if (insightsDoc.exists()) {
            const cachedInsights = insightsDoc.data() as CoachInsights;
            // Check if cache is less than 24 hours old
            const cacheAge = Date.now() - (cachedInsights.generatedAt || 0);
            if (cacheAge < 24 * 60 * 60 * 1000) {
              setInsights(cachedInsights);
              setLoading(false);
              
              // Load chat history if not already loaded
              if (!chatHistoryLoaded) {
                await loadChatHistory();
                setChatHistoryLoaded(true);
              }
              
              // Set initial welcoming message if chat is empty
              if (messages.length === 0) {
                const welcomeMsg: CoachMessage = {
                  id: 'init-msg',
                  sender: 'mentor',
                  text: `Sit down, kid. I've been looking over your profile at ${username}. I've got some notes on where you're headed. Look at my analysis below, and let's have a real, unfiltered chat about your 10-year outlook.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages([welcomeMsg]);
              }
              return;
            }
          }
        } catch (err) {
          console.warn('Failed to load coach insights from Firestore, fetching from API:', err);
        }
      }

      // No cache or force refresh, fetch from API
      const response = await fetch('/api/coach/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentResume }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error (status ${response.status}): ${text}`);
      }

      const data: CoachInsights = await response.json();
      data.generatedAt = Date.now();
      setInsights(data);
      
      // Save to Firestore
      if (db) {
        try {
          const insightsDocRef = doc(db, 'resumes', cleanUsernameLower, 'coachInsights', 'latest');
          await setDoc(insightsDocRef, data);
          console.log('Saved coach insights to Firestore');
        } catch (err) {
          console.error('Failed to save coach insights to Firestore:', err);
        }
      }
      
      // Load chat history if not already loaded
      if (!chatHistoryLoaded) {
        await loadChatHistory();
        setChatHistoryLoaded(true);
      }
      
      // Set welcoming message
      if (messages.length === 0) {
        const welcomeMsg: CoachMessage = {
          id: 'init-msg',
          sender: 'mentor',
          text: `Sit down, kid. I've been looking over your profile at ${username}. I've got some notes on where you're headed. Look at my analysis below, and let's have a real, unfiltered chat about your 10-year outlook.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([welcomeMsg]);
      }
    } catch (err: any) {
      console.error('Error fetching coach insights:', err);
      setError(err.message || 'Failed connecting with the Senior Coach.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [username, currentResume, isAuthenticated]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputValue;
    if (!textToSend.trim() || chatLoading) return;

    if (!customText) {
      setInputValue('');
    }

    const userMsg: CoachMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatLoading(true);

    try {
      const chatHistory = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentResume,
          message: textToSend,
          history: chatHistory
        }),
      });

      if (!response.ok) {
        throw new Error('Could not get mentor response');
      }

      const data = await response.json();
      
      const mentorMsg: CoachMessage = {
        id: `mentor-${Date.now()}`,
        sender: 'mentor',
        text: data.mentorResponse || "I've ran into compile errors on my side, kid. Re-try that query.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, mentorMsg];
      setMessages(finalMessages);
      
      // Save chat history to Firestore
      await saveChatHistory(finalMessages);

    } catch (err) {
      console.error('Coach chat error:', err);
      const errorMsg: CoachMessage = {
        id: `mentor-err-${Date.now()}`,
        sender: 'mentor',
        text: "Sorry, connection cut. Let's try that question again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      
      // Save even error messages
      await saveChatHistory(finalMessages);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const suggestions = [
    "Do you think my tech stack is too shallow?",
    "Should I switch to Golang/Kubernetes or double down on web interfaces?",
    "What core fundamentals am I missing to become a Principal Engineer?",
    "How can I turn my side projects into high-scale architectural proofs?"
  ];

  // Authentication gate
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-amber-500" />
        </div>
        <h3 className="font-display font-extrabold text-2xl text-white mb-3">GitHub Authentication Required</h3>
        <p className="text-sm text-slate-400 font-sans mb-8 max-w-lg leading-relaxed">
          The AI Career Coach requires access to your complete GitHub profile data to provide personalized career guidance. This includes:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 w-full max-w-xl text-left">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-mono font-bold text-amber-400 mb-2 uppercase tracking-wide">Repository Data</h4>
            <ul className="text-xs text-slate-300 space-y-1 font-sans">
              <li>• Starred repositories</li>
              <li>• Forked repositories</li>
              <li>• Watched repositories</li>
            </ul>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-mono font-bold text-amber-400 mb-2 uppercase tracking-wide">Contribution Analysis</h4>
            <ul className="text-xs text-slate-300 space-y-1 font-sans">
              <li>• Commit history</li>
              <li>• Pull requests</li>
              <li>• Issues & reviews</li>
            </ul>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-mono font-bold text-amber-400 mb-2 uppercase tracking-wide">Technical Profile</h4>
            <ul className="text-xs text-slate-300 space-y-1 font-sans">
              <li>• Languages used</li>
              <li>• Repository topics</li>
              <li>• Activity patterns</li>
            </ul>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-mono font-bold text-amber-400 mb-2 uppercase tracking-wide">Career Insights</h4>
            <ul className="text-xs text-slate-300 space-y-1 font-sans">
              <li>• Skill progression</li>
              <li>• Project diversity</li>
              <li>• Collaboration depth</li>
            </ul>
          </div>
        </div>

        <button
          onClick={onRequestAuth}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-display font-bold text-sm px-8 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-950/40"
        >
          <Github className="w-5 h-5" />
          Connect GitHub Account
        </button>
        
        <p className="text-xs text-slate-500 mt-6 font-mono">
          Your data is used solely for generating career insights and is never shared with third parties.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
          <BrainCircuit className="w-7 h-7 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <h3 className="font-display font-bold text-lg text-white mb-1">Alistair is reviewing your history...</h3>
        <p className="text-xs text-slate-400 font-mono max-w-sm">"Quiet most of the time; speaks up when something matters."</p>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-800 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <h3 className="font-display font-semibold text-white mb-2">Could not summon Alistair</h3>
        <p className="text-xs text-slate-400 font-mono mb-6 bg-slate-950 p-3 rounded-lg border border-slate-850 w-full text-left">
          {error || "Unknown advisor timeout error."}
        </p>
        <button
          onClick={() => fetchInsights(true)}
          className="bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs px-4 py-2 rounded-xl border border-slate-700 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
      
      {/* LEFT COLUMN: TRAJECTORY INVENTORY (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        
        {/* Coach Overview Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col gap-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-10" />
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-950/20 shrink-0">
                <Compass className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-extrabold text-lg text-white tracking-tight">{insights.mentorProfile.name}</h3>
                  <span className="bg-amber-500/15 text-amber-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                    Senior Mentor
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{insights.mentorProfile.role}</p>
                <p className="text-[10px] text-slate-500 italic mt-1 font-sans">Focus style: {insights.mentorProfile.style}</p>
              </div>
            </div>

            <button
              onClick={() => fetchInsights(true)}
              className="text-slate-500 hover:text-white hover:bg-slate-850 p-2 rounded-lg border border-transparent hover:border-slate-800 transition shrink-0"
              title="Force Re-analyze Career Trajectory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="border-t border-slate-800/80 pt-4 bg-slate-950/30 p-4 rounded-xl border border-slate-850/60 text-left">
            <div className="flex items-center gap-1.5 mb-2 font-mono text-[10px] uppercase tracking-wider text-amber-500 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Alistair's Career Trajectory Audit</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium italic">
              "{insights.overallVerdict}"
            </p>
          </div>
        </div>

        {/* 3 Career Interventions / Alerts */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">Critical Career Interventions (Speaks Up When It Matters)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            {insights.alerts.map((alert, index) => {
              const colors = [
                { bg: 'bg-red-950/15', border: 'border-red-900/40', text: 'text-red-400', badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
                { bg: 'bg-amber-950/15', border: 'border-amber-900/40', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
                { bg: 'bg-indigo-950/15', border: 'border-indigo-900/40', text: 'text-indigo-400', badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' }
              ];
              const theme = colors[index % colors.length];

              return (
                <div 
                  key={alert.id || index}
                  className={`rounded-2xl p-5 border ${theme.bg} ${theme.border} hover:border-slate-700/60 transition group text-left`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${theme.badge}`}>
                      {alert.type || 'trajectory'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">#0{index + 1}</span>
                  </div>

                  <h5 className="font-display font-bold text-sm text-slate-100 group-hover:text-white transition mb-2">
                    {alert.title}
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {alert.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quiet Chronological Observations Timeline */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-5 text-left">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">Chronicle of Quiet Observations</h4>
          </div>

          <div className="relative border-l border-slate-800 ml-2 pl-6 space-y-5">
            {insights.observations.map((obs, index) => (
              <div key={index} className="relative group">
                <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-950 group-hover:bg-amber-500 transition ring-4 ring-slate-950" />
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 group-hover:text-slate-400 transition mb-1">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span>{obs.timestamp || "June 2026"}</span>
                  <span className="text-slate-700">•</span>
                  <span>Silent Log Entry</span>
                </div>
                <p className="text-xs text-slate-400 group-hover:text-slate-300 transition font-sans leading-relaxed">
                  {obs.note}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: INTERACTIVE CONSULTATION CHAT (5 cols) */}
      <div className="lg:col-span-5 flex flex-col">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex-1 flex flex-col relative overflow-hidden min-h-[500px]">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-850 pb-3.5 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <div>
                <h3 className="font-display font-bold text-xs text-slate-200">Consultation Terminal</h3>
                <p className="text-[9px] text-slate-400 font-mono">Refined Career Trajectory Coaching</p>
              </div>
            </div>
            <span className="bg-slate-950 text-slate-400 border border-slate-850 text-[10px] font-mono px-2.5 py-0.5 rounded-md">
              Alistair Online
            </span>
          </div>

          {/* Chat scrolling board */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left min-h-[300px] max-h-[520px]">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div 
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${isUser ? 'ml-auto items-end animate-slice-in' : 'mr-auto items-start animate-fade-in'}`}
                >
                  <div className={`p-3.5 text-xs rounded-2xl leading-relaxed ${
                    isUser 
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none' 
                      : 'bg-slate-950 border border-slate-850 text-slate-200 rounded-tl-none font-sans'
                  }`}>
                    {/* Preserve line breaks if any */}
                    <div className="whitespace-pre-wrap select-text">{m.text}</div>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono mt-1 px-1.5">{m.timestamp}</span>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] p-2 bg-slate-950/50 rounded-xl border border-slate-900/60 max-w-[200px]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>Alistair is typing...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Presets Suggestions Quick Actions */}
          <div className="border-t border-slate-850/60 pt-4 mb-4 text-left">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-2">Preset Mentor Consultations</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  disabled={chatLoading}
                  onClick={() => handleSuggestionClick(sug)}
                  className="text-[10px] text-left text-slate-300 hover:text-amber-400 bg-slate-950 hover:bg-amber-500/5 hover:border-amber-500/20 border border-slate-900 rounded-lg py-1 px-2.5 font-sans transition cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt box input form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 border border-slate-800 bg-slate-950 group focus-within:border-amber-500/50 transition duration-150 p-1.5 rounded-xl shrink-0"
          >
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={chatLoading}
              placeholder="Ask Alistair about long-run career moves..."
              className="flex-1 bg-transparent border-0 outline-none focus:outline-none text-xs text-white placeholder-slate-500 px-3 py-1 font-sans"
            />
            <button
              type="submit"
              disabled={chatLoading || !inputValue.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-30 disabled:hover:bg-amber-500 p-2 rounded-lg transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
