
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDING = 'ENDING',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isTextOnly: boolean;
  engagementScore: number;
  lastActive: number;
  isDisengaged: boolean;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  type: 'user' | 'ai' | 'system';
  label?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface SessionSummary {
  keyPoints: string[];
  conceptsClarified: string[];
  revisionNeeded: string[];
  quiz: QuizQuestion[];
}

export interface StudyRoom {
  id: string;
  topic: string;
  hostName: string;
  startTime: number;
  status: SessionStatus;
  participants: User[];
  messages: Message[];
  summary?: SessionSummary;
}

export type AIResponseLabel = 
  | '[No Action Needed]'
  | '[Moderator Intervention]'
  | '[Engagement Nudge]'
  | '[AI Answer]'
  | '[Session Summary]'
  | '[Quiz]'
  | '[Feedback / Suggestions]';
