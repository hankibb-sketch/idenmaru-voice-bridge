'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase, SESSION_ID } from '@/lib/supabase';
import { Mic, Send, Bot, User, Check, X, ShieldCheck, Activity, Terminal, ExternalLink, Zap } from 'lucide-react';

interface LogEntry {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [textCommand, setTextCommand] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const [screenTimestamp, setScreenTimestamp] = useState<number>(Date.now());
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  const CORRECT_ID = process.env.NEXT_PUBLIC_AUTH_ID || 'hankbbb@gmail.com';
  const CORRECT_PASS = process.env.NEXT_PUBLIC_AUTH_PASS || 'gksrlqja72@';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASS) {
      setIsAuthenticated(true);
      speak("인증되었습니다. 이든마루 시스템 링크를 시작합니다.");
    } else {
      alert("비밀번호가 올바르지 않습니다.");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'ko-KR';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPendingCommand(transcript);
        stopListening();
        speak(`"${transcript}" 명령을 확인합니다.`);
      };

      rec.onend = () => setIsListening(false);
      setRecognition(rec);
    }

    // 2. Fetch Initial Logs
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('interaction_logs')
        .select('*')
        .eq('session_id', SESSION_ID)
        .order('timestamp', { ascending: true })
        .limit(50);

      if (data) {
        setLogs(data);
        setConnectionStatus('online');
      } else if (error) {
        setConnectionStatus('error');
      }
    };
    fetchLogs();

    // 3. Subscribe to Realtime Updates
    const channel = supabase.channel('chat_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'interaction_logs',
        filter: `session_id=eq.${SESSION_ID}`
      }, (payload) => {
        setLogs((prev) => [...prev, payload.new as LogEntry]);
        scrollToBottom();
      })
      .subscribe();

    // 4. Live Screen Update Interval
    const screenInterval = setInterval(() => {
      setScreenTimestamp(Date.now());
    }, 2500); // Update every 2.5 seconds to bypass cache

    return () => {
      channel.unsubscribe();
      clearInterval(screenInterval);
    };
  }, [isAuthenticated]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const initAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      source.connect(analyser.current);

      const updateLevel = () => {
        if (!analyser.current) return;
        const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        setAudioLevel(average);
        if (isListening) requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error('Audio Viz Error:', err);
    }
  };

  const startListening = () => {
    if (recognition) {
      setIsListening(true);
      setPendingCommand(null);
      recognition.start();
      initAudioVisualizer();
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
      if (audioContext.current) {
        audioContext.current.close();
      }
    }
  };

  const executeCommand = async (text: string) => {
    const { error } = await supabase.from('commands').insert({
      session_id: SESSION_ID,
      text: text,
      submit: true
    });

    if (error) {
      console.error('Send Error:', error);
    } else {
      setPendingCommand(null);
      speak("명령을 전송했습니다.");
    }
  };

  // 1. Render Security Gate (Premium Minimalist Redesign)
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FE] text-[#1D1D1F] p-6">
        <div className="w-full max-w-sm space-y-12">
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-[32px] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-200">
              <ShieldCheck size={48} className="text-white" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight">Access Key</h1>
              <p className="text-gray-400 font-medium">Enter your key to unlock the link.</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-8 py-6 bg-white border-2 border-transparent focus:border-indigo-500 rounded-[28px] shadow-xl shadow-indigo-100/20 text-center text-2xl tracking-[0.5em] focus:outline-none transition-all placeholder:text-gray-200"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-6 bg-indigo-600 text-white rounded-[28px] font-bold text-lg shadow-xl shadow-indigo-200 active:scale-95 transition-all"
            >
              Unlock Bridge
            </button>
          </form>

          <footer className="text-center">
            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-300">SECURE V4.5 PRO</span>
          </footer>
        </div>
      </div>
    );
  }

  // 2. Main Bridge OS UI (NotebookLM Inspired Professional Design)
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-[#202124] font-sans selection:bg-indigo-100">
      {/* Slim Header - NotebookLM Style */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
            <Bot size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight text-[#202124]">Bridge <span className="text-indigo-600">Connect</span></h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{connectionStatus === 'online' ? 'PC Online' : 'PC Offline'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 flex items-center gap-1.5">
            <Activity size={10} className="text-indigo-500" />
            <span className="text-[9px] font-black font-mono text-indigo-400">SESSION: {SESSION_ID.slice(-4)}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">

        {/* Left Column: 'Sources' & Capabilities (Mobile Hidden or Stacked) */}
        <aside className="w-full lg:w-72 bg-[#F8F9FA] border-r border-gray-200 p-6 space-y-8 hidden lg:block overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { icon: <Terminal size={16} />, label: "WEB SEARCH", desc: "네이버 검색", color: "text-blue-600", bg: "bg-blue-50" },
                { icon: <Activity size={16} />, label: "SCREEN AI", desc: "화면 분석", color: "text-indigo-600", bg: "bg-indigo-50" },
                { icon: <Zap size={16} />, label: "APP CONTROL", desc: "액셀 실행", color: "text-amber-600", bg: "bg-amber-50" },
                { icon: <Mic size={16} />, label: "MEDIA LINK", desc: "유튜브 틀어", color: "text-red-600", bg: "bg-red-50" },
              ].map((feat, i) => (
                <button
                  key={i}
                  onClick={() => setTextCommand(feat.desc)}
                  className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-100 active:scale-95 transition-all text-left"
                >
                  <div className={`w-8 h-8 shrink-0 rounded-lg ${feat.bg} ${feat.color} flex items-center justify-center`}>
                    {feat.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{feat.label}</span>
                    <p className="text-[13px] font-bold text-gray-700 truncate">"{feat.desc}"</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Column: Chat Stream */}
        <main ref={scrollRef} className="flex-1 bg-white relative flex flex-col h-[calc(100vh-100px)] lg:h-auto overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full px-4 lg:px-8 py-10 space-y-10 pb-40">
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-40 space-y-4 opacity-10">
                <Bot size={80} strokeWidth={1} />
                <p className="font-bold tracking-[0.5em] text-sm uppercase">Waiting for prompt</p>
              </div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white
                     ${log.sender === 'User' ? 'bg-indigo-500' : 'bg-[#5f6368]'}`}
                  >
                    {log.sender === 'User' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{log.sender}</span>
                  <span className="text-[10px] text-gray-300 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`text-[16px] leading-[1.6] font-medium tracking-tight whitespace-pre-wrap
                  ${log.sender === 'User' ? 'text-[#202124]' : 'text-[#3c4043]'}`}
                >
                  {log.message}
                </div>
              </div>
            ))}
          </div>

          {/* Floating Pill Input Bar - NotebookLM Style */}
          <div className="absolute bottom-8 left-0 right-0 px-4 lg:px-8 z-40">
            <div className="max-w-3xl mx-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (textCommand.trim() && !isComposing) {
                    executeCommand(textCommand);
                    setTextCommand('');
                  }
                }}
                className="bg-[#F8F9FA] lg:bg-white border border-gray-200 rounded-[32px] p-2 pr-2.5 flex items-center shadow-lg shadow-gray-200/50 hover:border-gray-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50 transition-all"
              >
                <input
                  type="text"
                  value={textCommand}
                  onChange={(e) => setTextCommand(e.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder="Ask bridge or type command..."
                  className="flex-1 bg-transparent py-4 px-6 text-[15px] sm:text-[18px] font-bold text-gray-800 focus:outline-none placeholder:text-gray-300"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                  >
                    <Mic size={18} />
                  </button>
                  <button
                    type="submit"
                    disabled={!textCommand.trim()}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md
                        ${textCommand.trim() ? 'bg-indigo-600 text-white scale-100' : 'bg-gray-100 text-gray-300 scale-95 opacity-50'}`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Right Column: Studio / Monitoring */}
        <aside className="w-full lg:w-80 bg-[#F8F9FA] border-l border-gray-200 p-6 space-y-8 hidden xl:block overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Vision Link</h3>
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-black group shadow-sm">
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full text-[9px] font-black text-white tracking-widest border border-white/10 uppercase">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                PC LIVE
              </div>
              <img
                key={screenTimestamp}
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screen-streams/${SESSION_ID}/live.jpg?t=${screenTimestamp}`}
                alt="Vision Stream"
                className="w-full h-auto aspect-video object-contain opacity-0 transition-opacity"
                onLoad={(e) => (e.currentTarget.style.opacity = '1')}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Studio</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "AI 오디오", bg: "bg-[#e8f0fe]", icon: <Mic size={16} className="text-blue-600" /> },
                { label: "스크린 샷", bg: "bg-[#e6f4ea]", icon: <Activity size={16} className="text-green-600" /> },
                { label: "데이터 분석", bg: "bg-[#fef7e0]", icon: <Terminal size={16} className="text-yellow-600" /> },
                { label: "자동 실행", bg: "bg-[#f3e8fd]", icon: <Zap size={16} className="text-purple-600" /> },
              ].map((item, id) => (
                <div key={id} className={`p-4 rounded-xl ${item.bg} border border-black/5 flex flex-col gap-3 group cursor-pointer hover:shadow-md transition-all active:scale-95`}>
                  <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
                    {item.icon}
                  </div>
                  <span className="text-[12px] font-bold text-gray-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @keyframes wave {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
        .animate-wave { animation: wave 0.6s ease-in-out infinite; }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
