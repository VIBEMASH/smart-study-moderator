
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SessionStatus, StudyRoom, Message, User, SessionSummary } from './types';
import { moderateDiscussion, generateSessionEndContent, generateSpeech } from './services/geminiService';
import Button from './components/Button';
import ChatWindow from './components/ChatWindow';
import ParticipantList from './components/ParticipantList';
import SummaryView from './components/SummaryView';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// Helper for unique IDs
const generateId = () => Math.random().toString(36).substr(2, 6).toUpperCase();

// --- Audio Helper Functions (Manual Implementation as per guidelines) ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
// ------------------------------------------------------------------------

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'CREATE' | 'JOIN' | 'ROOM' | 'SUMMARY'>('HOME');
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionPromiseRef = useRef<Promise<any> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const transcriptionBufferRef = useRef<string>('');

  // 1. Session Setup
  const createRoom = (topic: string, userName: string) => {
    const roomId = generateId();
    const host: User = {
      id: generateId(),
      name: userName,
      isHost: true,
      isMuted: false,
      isTextOnly: false,
      engagementScore: 100,
      lastActive: Date.now(),
      isDisengaged: false,
    };
    
    const newRoom: StudyRoom = {
      id: roomId,
      topic,
      hostName: userName,
      startTime: Date.now(),
      status: SessionStatus.ACTIVE,
      participants: [host],
      messages: [],
    };

    setRoom(newRoom);
    setCurrentUser(host);
    setView('ROOM');
  };

  const joinRoom = (roomId: string, userName: string, options: { muted: boolean, textOnly: boolean }) => {
    const participant: User = {
      id: generateId(),
      name: userName,
      isHost: false,
      isMuted: options.muted,
      isTextOnly: options.textOnly,
      engagementScore: 100,
      lastActive: Date.now(),
      isDisengaged: false,
    };

    setRoom(prev => prev ? {
      ...prev,
      participants: [...prev.participants, participant]
    } : null);
    setCurrentUser(participant);
    setView('ROOM');
  };

  // 2. Messaging & Moderation
  const sendMessage = useCallback(async (text: string, type: 'user' | 'ai' | 'system' = 'user', label?: string) => {
    if (!room || !currentUser) return;

    const newMessage: Message = {
      id: generateId(),
      userId: type === 'ai' ? 'ai' : currentUser.id,
      userName: type === 'ai' ? 'AI Moderator' : currentUser.name,
      text,
      timestamp: Date.now(),
      type,
      label
    };

    setRoom(prev => {
      if (!prev) return null;
      const updatedMessages = [...prev.messages, newMessage];
      const updatedParticipants = prev.participants.map(p => 
        p.id === currentUser.id 
          ? { ...p, lastActive: Date.now(), isDisengaged: false } 
          : p
      );
      return { ...prev, messages: updatedMessages, participants: updatedParticipants };
    });

    lastActivityRef.current = Date.now();

    if (type === 'user') {
      const response = await moderateDiscussion(room.topic, [...room.messages, newMessage]);
      if (response) {
        sendMessage(response.text, 'ai', response.label);
        // If voice is active, AI also speaks back
        if (isVoiceActive) playTTS(response.text);
      }
    }
  }, [room, currentUser, isVoiceActive]);

  // 3. Audio & Voice (TTS)
  const playTTS = async (text: string) => {
    const audioData = await generateSpeech(text);
    if (!audioData) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const bytes = decode(audioData);
    const buffer = await decodeAudioData(bytes, ctx, 24000, 1);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  };

  // 4. Gemini Live STT Implementation
  useEffect(() => {
    let micStream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    let inputAudioContext: AudioContext | null = null;

    if (isVoiceActive && view === 'ROOM' && currentUser && !currentUser.isTextOnly) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
              micStream = stream;
              const source = inputAudioContext!.createMediaStreamSource(stream);
              scriptProcessor = inputAudioContext!.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContext!.destination);
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle input transcription (what user is saying)
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              transcriptionBufferRef.current += text;
            }

            // When a turn is complete, commit the transcription to the chat
            if (message.serverContent?.turnComplete) {
              const finalTrans = transcriptionBufferRef.current.trim();
              if (finalTrans) {
                sendMessage(finalTrans);
              }
              transcriptionBufferRef.current = '';
            }
          },
          onerror: (e) => console.error('Live session error:', e),
          onclose: () => console.log('Live session closed'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: `You are the AI Moderator for a study room about "${room?.topic}". Listen to the students and help them stay focused.`
        }
      });

      liveSessionPromiseRef.current = sessionPromise;
    }

    return () => {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (scriptProcessor) scriptProcessor.disconnect();
      if (inputAudioContext) inputAudioContext.close();
      if (liveSessionPromiseRef.current) {
        liveSessionPromiseRef.current.then(session => session.close());
        liveSessionPromiseRef.current = null;
      }
    };
  }, [isVoiceActive, view, room?.topic, currentUser, sendMessage]);

  // 5. Presence Detection & Inactivity
  useEffect(() => {
    if (view !== 'ROOM') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      
      if (idleTime > 120000 && currentUser && !currentUser.isDisengaged) {
        setRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            participants: prev.participants.map(p => 
              p.id === currentUser.id ? { ...p, isDisengaged: true } : p
            )
          };
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [view, currentUser]);

  // 6. Ending Session
  const endSession = async () => {
    if (!room) return;
    setIsLoading(true);
    try {
      const summary = await generateSessionEndContent(room.topic, room.messages);
      setRoom(prev => prev ? { ...prev, status: SessionStatus.COMPLETED, summary } : null);
      setView('SUMMARY');
    } catch (error) {
      alert("Failed to generate summary. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Views Logic
  if (view === 'HOME') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Smart Study Moderator</h1>
            <p className="text-slate-500 font-medium text-lg italic">“AI-powered focus for group study”</p>
          </div>
          <div className="grid grid-cols-1 gap-4 pt-4">
            <button onClick={() => setView('CREATE')} className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-3xl hover:border-blue-500 hover:shadow-xl transition-all duration-300">
              <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 mb-3 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="text-xl font-bold text-slate-800">Create Study Room</span>
              <p className="text-sm text-slate-500 mt-1">Start a new session and invite others</p>
            </button>
            <button onClick={() => setView('JOIN')} className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-3xl hover:border-green-500 hover:shadow-xl transition-all duration-300">
              <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors duration-300 mb-3 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <span className="text-xl font-bold text-slate-800">Join Study Room</span>
              <p className="text-sm text-slate-500 mt-1">Enter a room code to participate</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'CREATE') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl border shadow-xl w-full max-w-md space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Set Up Your Session</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Your Name</label>
              <input id="userName" type="text" placeholder="Enter your name" className="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Study Topic</label>
              <input id="topic" type="text" placeholder="e.g., Operating Systems - Deadlocks" className="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <Button variant="secondary" onClick={() => setView('HOME')}>Cancel</Button>
            <Button fullWidth onClick={() => {
              const name = (document.getElementById('userName') as HTMLInputElement).value;
              const topic = (document.getElementById('topic') as HTMLInputElement).value;
              if (name && topic) createRoom(topic, name);
            }}>Start Session</Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'JOIN') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl border shadow-xl w-full max-w-md space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Join a Session</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Room Code</label>
              <input id="roomCode" type="text" placeholder="Enter 6-digit code" className="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-green-500 outline-none transition-all uppercase" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Your Name</label>
              <input id="joinName" type="text" placeholder="Enter your name" className="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-green-500 outline-none transition-all" />
            </div>
            <div className="flex items-center space-x-4 p-3 bg-slate-50 rounded-xl">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" id="muted" className="mr-2" />
                <span className="text-xs font-medium text-slate-600">Start Muted</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" id="textOnly" className="mr-2" />
                <span className="text-xs font-medium text-slate-600">Text Only</span>
              </label>
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <Button variant="secondary" onClick={() => setView('HOME')}>Cancel</Button>
            <Button variant="success" fullWidth onClick={() => {
              const code = (document.getElementById('roomCode') as HTMLInputElement).value;
              const name = (document.getElementById('joinName') as HTMLInputElement).value;
              const muted = (document.getElementById('muted') as HTMLInputElement).checked;
              const textOnly = (document.getElementById('textOnly') as HTMLInputElement).checked;
              if (code && name) joinRoom(code, name, { muted, textOnly });
            }}>Join Room</Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'SUMMARY' && room?.summary) {
    return (
      <div className="min-h-screen bg-slate-50 overflow-y-auto">
        <SummaryView summary={room.summary} onClose={() => setView('HOME')} />
      </div>
    );
  }

  if (view === 'ROOM' && room && currentUser) {
    return (
      <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
        <header className="h-16 bg-white border-b px-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-none">{room.topic}</h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Room: {room.id}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => { navigator.clipboard.writeText(room.id); alert("Room code copied!"); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors">Share Code</button>
            {currentUser.isHost && <Button size="sm" variant="danger" onClick={endSession} disabled={isLoading}>{isLoading ? 'Wrapping up...' : 'End Session'}</Button>}
          </div>
        </header>

        <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-4 gap-4">
          <ParticipantList participants={room.participants} topic={room.topic} />
          <div className="flex-1 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden relative">
            <ChatWindow messages={room.messages} currentUserId={currentUser.id} />
            <div className="p-4 bg-slate-50 border-t flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <button onClick={() => setIsVoiceActive(!isVoiceActive)} className={`p-2.5 rounded-full transition-all ${isVoiceActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border text-slate-400 hover:text-slate-600'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
                <form className="flex-1 flex space-x-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (inputText.trim()) { sendMessage(inputText.trim()); setInputText(''); }
                }}>
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message or ask AI a question..." className="flex-1 bg-white px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm" />
                  <Button type="submit" disabled={!inputText.trim()}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </Button>
                </form>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-slate-400 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></span>
                  {isVoiceActive ? 'Microphone is active (Real-time STT)' : 'AI is listening for off-topic discussion'}
                </span>
                <span className="text-[10px] text-slate-400">Engagement: {currentUser.engagementScore}%</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
};

export default App;
