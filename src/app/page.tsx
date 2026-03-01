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

  // 1. Render Security Gate if Not Authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#020205] text-[#e0e0f0]">
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-800 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10 w-full max-w-md p-10 space-y-8 bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.3)]">
              <ShieldCheck size={44} className="text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white italic">
              Bridge <span className="text-cyan-400">Auth</span>
            </h1>
            <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-gray-500">Secure Access Point V3.1</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-3">
              <div className="relative group">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="text"
                  placeholder="ID (EMAIL)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-cyan-500/50 transition-all text-white font-mono text-sm tracking-widest placeholder-gray-700"
                  autoFocus
                />
              </div>
              <div className="relative group">
                <Zap size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-indigo-500/50 transition-all text-white font-mono text-sm tracking-widest placeholder-gray-700"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-5 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-cyan-900/40"
            >
              System Access
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 opacity-20">
            <Activity size={12} className="text-cyan-400" />
            <span className="text-[9px] font-mono tracking-[0.4em] uppercase">Protocol: IDENMARU-OS-RECOGNITION</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Bridge OS UI
  return (
    <div className="flex flex-col h-screen bg-[#020205] text-[#e0e0f0] font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* ... previous content remained same ... */}
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-800 rounded-full blur-[120px]"></div>
      </div>

      {/* Premium Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 bg-[#050510]/80 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <Zap size={22} className="text-white fill-current" />
            </div>
            {connectionStatus === 'online' && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#050510] rounded-full animate-pulse"></span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">
              Bridge <span className="text-cyan-400">OS</span>
            </h1>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <Activity size={10} className="text-cyan-500" />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest animate-pulse">
                System Link Established
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 items-center gap-2">
            <Terminal size={12} className="text-gray-400" />
            <span className="text-[11px] font-mono text-gray-300">{SESSION_ID}</span>
          </div>
          <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <ExternalLink size={18} className="text-gray-400" />
          </button>
        </div>
      </header>

      {/* Interaction Logs & Live Screen */}
      <main
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth"
      >
        {/* Live PC Screen Monitor */}
        <div className="relative group max-w-4xl mx-auto rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black/40 backdrop-blur-md">
          <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">LIVE MONITOR</span>
          </div>
          <img
            key={screenTimestamp}
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screen-streams/${SESSION_ID}/live.jpg?t=${screenTimestamp}`}
            alt="PC Screen Live"
            className="w-full h-auto aspect-video object-cover transition-opacity duration-700 ease-in-out opacity-0"
            onLoad={(e) => (e.currentTarget.style.opacity = '1')}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] opacity-30"></div>
        </div>

        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center space-y-4 opacity-20 py-10">
            <ShieldCheck size={64} strokeWidth={1} />
            <p className="text-center font-light tracking-widest text-sm italic">READY FOR VOICE INPUT</p>
          </div>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            className={`flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-500 ${log.sender === 'User' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-2 px-1">
              {log.sender !== 'User' && <Bot size={14} className="text-cyan-500" />}
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-gray-500 group-hover:text-gray-300 transition-colors">
                {log.sender}
              </span>
              <span className="text-[9px] font-mono text-gray-600">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              {log.sender === 'User' && <User size={14} className="text-indigo-400" />}
            </div>

            <div className={`relative max-w-[90%] p-4 rounded-3xl shadow-2xl transition-all duration-300 group-hover:scale-[1.01]
              ${log.sender === 'User'
                ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-tr-none border border-white/10 shadow-indigo-900/20'
                : log.sender === 'Error'
                  ? 'bg-red-900/40 text-red-100 rounded-tl-none border border-red-500/20'
                  : 'bg-[#0F0F1A] text-[#d0d0f0] rounded-tl-none border border-white/5'
              }`}
            >
              <p className="text-[15px] leading-relaxed font-normal">{log.message}</p>
            </div>
          </div>
        ))}
      </main>

      {/* Large Voice/Action Footer */}
      <footer className="relative z-20 pb-12 pt-6 px-10 bg-gradient-to-t from-[#020205] via-[#020205] to-transparent">

        {/* Floating Confirmation Card (Usability Focus) */}
        {pendingCommand && (
          <div className="absolute bottom-[105%] left-0 right-0 px-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="bg-[#0A0A1F] border border-white/10 p-8 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] border-b-4 border-b-cyan-500 overflow-hidden relative group">
              <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-all duration-700"></div>

              <div className="relative flex flex-col gap-6">
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[5px] text-cyan-400 mb-2">Intent Detection</h3>
                  <div className="text-2xl font-bold text-white leading-tight">
                    "{pendingCommand}"
                  </div>
                  <p className="text-sm text-gray-500">PC로 명령을 전송할까요? (Shall I send this?)</p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setPendingCommand(null)}
                    className="flex-1 py-5 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <X size={20} /> 취소
                  </button>
                  <button
                    onClick={() => executeCommand(pendingCommand)}
                    className="flex-[1.5] py-5 rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-lg shadow-xl shadow-cyan-900/40 transition-all hover:shadow-cyan-400/20 active:scale-95 flex items-center justify-center gap-3"
                  >
                    <Check size={24} strokeWidth={3} /> 전송
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Massive Main Voice Button */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            {/* Visualizer Ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-cyan-500/20 scale-125 transition-transform duration-100"
              style={{ transform: `scale(${1.2 + (audioLevel / 100)})`, opacity: isListening ? 1 : 0 }}
            ></div>
            <div
              className="absolute inset-0 rounded-full border border-indigo-400/20 scale-150 transition-transform duration-150"
              style={{ transform: `scale(${1.4 + (audioLevel / 80)})`, opacity: isListening ? 0.5 : 0 }}
            ></div>

            <button
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl
                ${isListening
                  ? 'bg-red-500 scale-95 shadow-[0_0_50px_rgba(239,68,68,0.4)]'
                  : 'bg-white text-[#050510] hover:scale-105 active:scale-90 shadow-[0_0_30px_rgba(255,255,255,0.1)]'
                }`}
            >
              {isListening ? (
                <div className="flex items-center gap-1.5 h-10">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-white rounded-full animate-wave"
                      style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}
                    ></div>
                  ))}
                </div>
              ) : (
                <Mic size={40} strokeWidth={2.5} />
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className={`text-[12px] font-black uppercase tracking-[4px] transition-colors duration-500 ${isListening ? 'text-red-500' : 'text-gray-500'}`}>
              {isListening ? 'Streaming Audio' : 'Hold To Command'}
            </span>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-1 h-1 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}></div>
              ))}
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
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
