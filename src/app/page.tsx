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
  const [userId, setUserId] = useState('');
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  const CORRECT_ID = process.env.NEXT_PUBLIC_AUTH_ID || 'hankbbb@gmail.com';
  const CORRECT_PASS = process.env.NEXT_PUBLIC_AUTH_PASS || 'gksrlqja72@';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userId === CORRECT_ID && password === CORRECT_PASS) {
      setIsAuthenticated(true);
      speak("인증되었습니다. 이든마루 시스템 링크를 시작합니다.");
    } else {
      alert("ID 또는 비밀번호가 올바르지 않습니다.");
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
  }, []);

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

  // 1. Render Security Gate (Lumina Light Redesign)
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F8F9FD] text-[#1A1C1E]">
        {/* Soft Ambient Orbs */}
        <div className="fixed inset-0 pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative z-10 w-full max-w-md p-10 space-y-8 bg-white/70 backdrop-blur-3xl rounded-[48px] border border-white/80 shadow-[0_20px_50px_rgba(31,38,135,0.07)] text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-[32px] bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_15px_30px_rgba(59,130,246,0.2)]">
              <ShieldCheck size={44} className="text-white" />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-[#1A1C1E] italic">
              Bridge <span className="text-blue-500">Auth</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-400">Secure Access Point V4.0</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-3">
              <div className="relative group">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="ID (EMAIL)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-gray-50/50 border border-gray-200 rounded-3xl focus:outline-none focus:border-blue-400 focus:bg-white transition-all text-gray-800 font-medium text-sm tracking-wide placeholder-gray-400 shadow-sm"
                  autoFocus
                />
              </div>
              <div className="relative group">
                <Zap size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-gray-50/50 border border-gray-200 rounded-3xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-gray-800 font-medium text-sm tracking-wide placeholder-gray-400 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-5 bg-[#1A1C1E] text-white rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/10"
            >
              Initialize Bridge
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 opacity-40">
            <Activity size={12} className="text-blue-500" />
            <span className="text-[9px] font-mono tracking-[0.4em] uppercase font-bold">LUMINA PROTOCOL ACTIVE</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Bridge OS UI (Lumina Light Redesign)
  return (
    <div className="flex flex-col h-screen bg-[#F0F2F7] text-[#1A1C1E] font-sans selection:bg-blue-500/20 overflow-hidden">
      {/* Background Mesh Orbs */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-200 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-100 rounded-full blur-[150px]"></div>
      </div>

      {/* Premium Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 bg-white/60 backdrop-blur-2xl border-b border-white/80 shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-[18px] bg-[#1A1C1E] flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
              <Zap size={24} className="text-blue-400 fill-current" />
            </div>
            {connectionStatus === 'online' && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white rounded-full"></span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#1A1C1E] uppercase italic">
              Bridge <span className="text-blue-600">OS</span>
            </h1>
            <div className="flex items-center gap-1.5">
              <Activity size={10} className="text-blue-500" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">
                Neural Link Ready
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex px-4 py-2 rounded-2xl bg-white border border-gray-100 items-center gap-2 shadow-sm">
            <Terminal size={14} className="text-gray-400" />
            <span className="text-[12px] font-bold text-gray-500 tracking-tight">{SESSION_ID}</span>
          </div>
          <button className="p-2.5 rounded-2xl bg-white border border-gray-100 hover:bg-gray-50 transition-colors shadow-sm text-gray-400">
            <ExternalLink size={20} />
          </button>
        </div>
      </header>

      {/* Interaction Logs & Live Screen */}
      <main
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-8 py-10 space-y-10 scroll-smooth"
      >
        {/* Live PC Screen Monitor */}
        <div className="relative group max-w-5xl mx-auto rounded-[40px] overflow-hidden border border-white/50 shadow-[0_40px_80px_rgba(0,0,0,0.08)] bg-white/40 backdrop-blur-md">
          <div className="absolute top-6 left-8 z-20 flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-gray-100 shadow-sm">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-700">REMOTE VIEW</span>
          </div>
          <img
            key={screenTimestamp}
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screen-streams/${SESSION_ID}/live.jpg?t=${screenTimestamp}`}
            alt="PC Screen Live"
            className="w-full h-auto aspect-video object-cover transition-opacity duration-1000 ease-in-out opacity-0"
            onLoad={(e) => (e.currentTarget.style.opacity = '1')}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          {/* Elegant Overlay */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-white/10 rounded-[40px]"></div>
        </div>

        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center space-y-4 opacity-30 py-16">
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg mb-4">
              <ShieldCheck size={48} className="text-blue-500" strokeWidth={1.5} />
            </div>
            <p className="text-center font-bold tracking-[0.2em] text-sm text-gray-500 uppercase italic">Initialized & Ready</p>
          </div>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            className={`flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-700 ${log.sender === 'User' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-3 px-2">
              {log.sender !== 'User' && <Bot size={16} className="text-blue-500" />}
              <span className="text-[11px] font-black uppercase tracking-[2px] text-gray-400">
                {log.sender}
              </span>
              <span className="text-[10px] font-mono text-gray-300">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {log.sender === 'User' && <User size={16} className="text-indigo-500" />}
            </div>

            <div className={`relative max-w-[85%] p-6 rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.03)] transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] border border-white/80
              ${log.sender === 'User'
                ? 'bg-white text-gray-800 rounded-tr-none'
                : log.sender === 'Error'
                  ? 'bg-red-50 text-red-700 rounded-tl-none border-red-100'
                  : 'bg-white/80 text-gray-700 rounded-tl-none'
              }`}
            >
              <p className="text-[16px] leading-[1.6] font-medium tracking-tight">{log.message}</p>
            </div>
          </div>
        ))}
      </main>

      {/* Massive Main Footer (Lumina Light Redesign) */}
      <footer className="relative z-20 pb-16 pt-10 px-12 bg-gradient-to-t from-white via-white/90 to-transparent">

        {/* Floating Confirmation Card (Lumina Light) */}
        {pendingCommand && (
          <div className="absolute bottom-[110%] left-0 right-0 px-8 animate-in slide-in-from-bottom-12 fade-in duration-600">
            <div className="max-w-xl mx-auto bg-white/90 backdrop-blur-3xl border border-white p-10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.1)] border-b-[6px] border-b-blue-600 overflow-hidden relative group">
              <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-blue-100/30 rounded-full blur-3xl transition-all duration-1000 group-hover:scale-110"></div>

              <div className="relative flex flex-col gap-6 text-center">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[5px] text-blue-500">VOICE CONFIRMATION</h3>
                  <div className="text-3xl font-black text-gray-900 leading-tight tracking-tighter">
                    "{pendingCommand}"
                  </div>
                  <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">Execute this command on PC?</p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setPendingCommand(null)}
                    className="flex-1 py-5 rounded-[28px] bg-gray-50 hover:bg-gray-100 text-gray-400 font-black transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-[11px] tracking-widest"
                  >
                    <X size={20} className="text-gray-300" /> Cancel
                  </button>
                  <button
                    onClick={() => executeCommand(pendingCommand)}
                    className="flex-[1.5] py-5 rounded-[28px] bg-[#1A1C1E] text-white font-black text-xs tracking-[0.2em] shadow-xl shadow-gray-200 transition-all hover:bg-blue-600 active:scale-95 flex items-center justify-center gap-3 uppercase"
                  >
                    <Check size={24} className="text-blue-400" /> Confirm Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Text Command Input Bar (Lumina Light) */}
        <div className="w-full max-w-2xl mx-auto mb-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textCommand.trim() && !isComposing) {
                executeCommand(textCommand);
                setTextCommand('');
              }
            }}
            className="relative"
          >
            <div className="absolute inset-0 bg-blue-500/10 rounded-[32px] blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
            <div className="relative flex items-center bg-white border border-gray-100 rounded-[28px] p-2 shadow-[0_15px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all group">
              <div className="pl-6 text-gray-300 group-focus-within:text-blue-500 transition-colors">
                <Terminal size={20} />
              </div>
              <input
                type="text"
                value={textCommand}
                onChange={(e) => setTextCommand(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="Type your command..."
                className="flex-1 bg-transparent border-none py-5 px-5 text-gray-800 placeholder-gray-300 focus:outline-none text-base font-medium tracking-tight"
              />
              <button
                type="submit"
                disabled={!textCommand.trim()}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${textCommand.trim() ? 'bg-[#1A1C1E] text-white shadow-lg hover:bg-blue-600 active:scale-90' : 'bg-gray-50 text-gray-200'}`}
              >
                <Send size={22} strokeWidth={2.5} />
              </button>
            </div>
          </form>
        </div>

        {/* High-End Voice Action */}
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            {/* Soft Ambient Rings */}
            <div
              className="absolute inset-0 rounded-full bg-blue-500/5 transition-transform duration-300"
              style={{ transform: `scale(${1.2 + (audioLevel / 100)})`, opacity: isListening ? 1 : 0 }}
            ></div>

            <button
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 shadow-[0_20px_60px_rgba(0,0,0,0.08)]
                ${isListening
                  ? 'bg-red-500 scale-105 shadow-[0_30px_70px_rgba(239,68,68,0.3)]'
                  : 'bg-[#1A1C1E] text-white hover:scale-110 active:scale-90 shadow-[0_25px_50px_rgba(0,0,0,0.15)]'
                }`}
            >
              {isListening ? (
                <div className="flex items-center gap-2 h-12">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-white rounded-full animate-wave"
                      style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.15}s` }}
                    ></div>
                  ))}
                </div>
              ) : (
                <Mic size={48} strokeWidth={2} />
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <span className={`text-[12px] font-black uppercase tracking-[0.5em] transition-colors duration-700 ${isListening ? 'text-red-500' : 'text-gray-400'}`}>
              {isListening ? 'Neural Audio In' : 'Speak to Control'}
            </span>
            <div className="flex gap-1.5 h-1.5 overflow-hidden">
              <div className={`w-8 rounded-full ${isListening ? 'bg-red-500 animate-[pulse_1s_infinite]' : 'bg-gray-200'}`}></div>
              <div className={`w-3 rounded-full ${isListening ? 'bg-red-400 animate-[pulse_1.5s_infinite]' : 'bg-gray-200'}`}></div>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
        .animate-wave {
          animation: wave 0.8s ease-in-out infinite;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}
