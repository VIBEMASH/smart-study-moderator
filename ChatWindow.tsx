
import React, { useRef, useEffect } from 'react';
import { Message } from '../types';

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, currentUserId }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 bg-white rounded-t-xl border-x border-t"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>Start the discussion. AI Moderator is listening...</p>
        </div>
      )}
      
      {messages.map((msg) => {
        const isMe = msg.userId === currentUserId;
        const isAI = msg.type === 'ai';
        const isSystem = msg.type === 'system';

        if (isSystem) {
          return (
            <div key={msg.id} className="flex justify-center">
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {msg.text}
              </span>
            </div>
          );
        }

        return (
          <div 
            key={msg.id} 
            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-semibold text-slate-500">
                {isAI ? 'AI Moderator' : msg.userName}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                isMe 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : isAI 
                    ? 'bg-amber-50 border border-amber-200 text-slate-800 rounded-tl-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
              }`}
            >
              {isAI && msg.label && (
                <div className="text-[10px] font-bold uppercase mb-1 text-amber-600 opacity-80">
                  {msg.label}
                </div>
              )}
              {msg.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatWindow;
