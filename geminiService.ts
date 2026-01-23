
import { GoogleGenAI, Type } from "@google/genai";
import { Message, SessionSummary, AIResponseLabel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const moderateDiscussion = async (
  topic: string, 
  messages: Message[]
): Promise<{ label: AIResponseLabel; text: string } | null> => {
  if (messages.length === 0) return null;

  const recentMessages = messages.slice(-5).map(m => `${m.userName}: ${m.text}`).join('\n');
  
  const prompt = `You are a Smart Study Moderator for a session on "${topic}".
  Analyze the following recent conversation:
  ${recentMessages}

  Tasks:
  1. Determine if the discussion is on-topic, partially related, or off-topic.
  2. If off-topic, provide a polite, supportive intervention.
  3. If a user asked you (AI) a question, answer it concisely.
  4. If someone seems disengaged (no activity in transcript), suggest a nudge.
  
  Return your response with one of these labels:
  [No Action Needed] - If everything is fine and on-topic.
  [Moderator Intervention] - If off-topic or disruptive.
  [Engagement Nudge] - If specific users seem to need a check-in.
  [AI Answer] - If answering a direct question.

  Keep interventions supportive and brief.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const output = response.text || '';
    const firstLine = output.split('\n')[0];
    const labelMatch = firstLine.match(/\[.*?\]/);
    
    if (labelMatch) {
      const label = labelMatch[0] as AIResponseLabel;
      if (label === '[No Action Needed]') return null;
      return {
        label,
        text: output.replace(label, '').trim()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Moderation Error:", error);
    return null;
  }
};

export const generateSessionEndContent = async (
  topic: string,
  messages: Message[]
): Promise<SessionSummary> => {
  const fullTranscript = messages.map(m => `${m.userName}: ${m.text}`).join('\n');

  const prompt = `Based on this study session transcript about "${topic}", generate a summary and a quiz.
  
  Transcript:
  ${fullTranscript}

  Respond with a JSON object following this schema:
  {
    "keyPoints": ["point 1", "point 2"],
    "conceptsClarified": ["concept 1"],
    "revisionNeeded": ["topic area"],
    "quiz": [
      {
        "question": "question text?",
        "options": ["A", "B", "C", "D"],
        "correctAnswer": 0
      }
    ]
  }
  Ensure exactly 3-5 MCQ questions. Focus on potential weak areas mentioned in the transcript.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            conceptsClarified: { type: Type.ARRAY, items: { type: Type.STRING } },
            revisionNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Speak supportively: ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
};
