
import React, { useState } from 'react';
import { SessionSummary, QuizQuestion } from '../types';
import Button from './Button';

interface SummaryViewProps {
  summary: SessionSummary;
  onClose: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ summary, onClose }) => {
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
    if (index === summary.quiz[currentQuizIndex].correctAnswer) {
      setScore(s => s + 1);
    }
    
    setTimeout(() => {
      if (currentQuizIndex < summary.quiz.length - 1) {
        setCurrentQuizIndex(i => i + 1);
        setSelectedAnswer(null);
      } else {
        setQuizFinished(true);
      }
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Session Wrap-up</h1>
        <p className="text-slate-500">Here's how your study group performed today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h2 className="font-bold">Key Points</h2>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
            {summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-green-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <h2 className="font-bold">Clarified Concepts</h2>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
            {summary.conceptsClarified.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="font-bold">Needs Revision</h2>
          </div>
          <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
            {summary.revisionNeeded.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-3xl p-8 overflow-hidden relative shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.827a1 1 0 00-.788 0l-7 3a1 1 0 000 1.848l7 3a1 1 0 00.788 0l7-3a1 1 0 000-1.848l-7-3zM14 11.559V13a1 1 0 01-.553.894l-4 2a1 1 0 01-.894 0l-4-2A1 1 0 014 13v-1.441l4.898 2.099a2 2 0 001.53 0L14 11.559z" /></svg>
        </div>

        {!quizFinished ? (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-blue-400">
              <span>Knowledge Check</span>
              <span>Question {currentQuizIndex + 1} of {summary.quiz.length}</span>
            </div>
            <h3 className="text-xl font-bold leading-tight">
              {summary.quiz[currentQuizIndex].question}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {summary.quiz[currentQuizIndex].options.map((opt, i) => (
                <button
                  key={i}
                  disabled={selectedAnswer !== null}
                  onClick={() => handleAnswer(i)}
                  className={`p-4 rounded-xl text-left border-2 transition-all duration-200 ${
                    selectedAnswer === i 
                      ? (i === summary.quiz[currentQuizIndex].correctAnswer ? 'bg-green-500 border-green-500 text-white' : 'bg-red-500 border-red-500 text-white')
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6 max-w-sm mx-auto">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-500/50">
              <span className="text-3xl font-bold">{Math.round((score / summary.quiz.length) * 100)}%</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Great Effort!</h3>
              <p className="text-slate-400 mt-2">You answered {score} out of {summary.quiz.length} questions correctly.</p>
            </div>
            <Button variant="primary" size="lg" fullWidth onClick={onClose}>
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryView;
