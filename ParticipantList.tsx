
import React from 'react';
import { User } from '../types';

interface ParticipantListProps {
  participants: User[];
  topic: string;
}

const ParticipantList: React.FC<ParticipantListProps> = ({ participants, topic }) => {
  return (
    <div className="w-full md:w-64 bg-white border rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b bg-slate-50">
        <h3 className="font-bold text-slate-900 truncate" title={topic}>{topic}</h3>
        <p className="text-xs text-slate-500 mt-1">{participants.length} Participant{participants.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {participants.map((user) => (
          <div 
            key={user.id} 
            className="flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors group"
          >
            <div className="relative">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                user.isDisengaged ? 'bg-slate-400 grayscale' : 'bg-gradient-to-br from-blue-400 to-indigo-600'
              }`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${
                user.isDisengaged ? 'bg-amber-400' : 'bg-green-500'
              }`} />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium truncate ${user.isDisengaged ? 'text-slate-400' : 'text-slate-900'}`}>
                  {user.name}
                  {user.isHost && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Host</span>}
                </p>
                <span className="text-[10px] text-slate-400 group-hover:block hidden">
                  {user.engagementScore}%
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400">
                  {user.isTextOnly ? 'Text Only' : (user.isMuted ? 'Muted' : 'Speaking')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantList;
