
import React, { useState, useEffect, useRef } from 'react';
import { Send, Volume2, Zap, StopCircle, Loader2, Brain, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message, TeacherSettings } from '../types';
import { generateTextResponse, generateTTS } from '../services/geminiService';

interface ChatInterfaceProps {
  settings: TeacherSettings;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ settings }) => {
  const [input, setInput] = useState('');
  
  // Initialize messages from localStorage or default
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('chat_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
    return [{
      role: 'model',
      content: 'Bonjour! Je suis votre enseignant virtuel. Comment puis-je vous aider aujourd\'hui?',
      timestamp: Date.now()
    }];
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [useFastLite, setUseFastLite] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // Prepare history for API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const responseText = await generateTextResponse(history, userMsg.content, settings, useFastLite, useThinking);

      const modelMsg: Message = { role: 'model', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      console.error("Chat generation error:", err);
      let errorMessage = "Désolé, une erreur est survenue. Veuillez réessayer.";
      
      // Analyze error message for better feedback
      const errorText = err.message || JSON.stringify(err);
      
      if (errorText.includes("SAFETY") || errorText.includes("blocked")) {
        errorMessage = "⚠️ Je ne peux pas répondre à cette demande car elle a été signalée par les filtres de sécurité. Veuillez reformuler votre question de manière appropriée.";
      } else if (errorText.includes("429") || errorText.includes("quota")) {
        errorMessage = "⏳ La limite de requêtes a été atteinte. Merci de patienter quelques instants avant de réessayer.";
      } else if (errorText.includes("503") || errorText.includes("overloaded")) {
         errorMessage = "🔌 Le service est temporairement surchargé. Veuillez réessayer dans un instant.";
      } else if (errorText.includes("network") || errorText.includes("fetch")) {
         errorMessage = "🌐 Problème de connexion internet détecté. Vérifiez votre réseau.";
      } else if (errorText.includes("API key")) {
         errorMessage = "🔑 Erreur de configuration : Clé API manquante ou invalide.";
      }

      setMessages(prev => [...prev, { role: 'model', content: errorMessage, timestamp: Date.now() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const playTTS = async (text: string) => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      const buffer = await generateTTS(text);
      if (buffer) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if(ctx) {
           const source = ctx.createBufferSource();
           source.buffer = buffer;
           source.connect(ctx.destination);
           source.onended = () => setIsPlayingAudio(false);
           source.start();
        }
      } else {
        setIsPlayingAudio(false);
      }
    } catch (e) {
      console.error(e);
      setIsPlayingAudio(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Êtes-vous sûr de vouloir effacer l'historique de la conversation ?")) {
      const initialMsg: Message = {
        role: 'model',
        content: 'Bonjour! Je suis votre enseignant virtuel. Comment puis-je vous aider aujourd\'hui?',
        timestamp: Date.now()
      };
      setMessages([initialMsg]);
      localStorage.removeItem('chat_history');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
        <div>
            <h2 className="font-semibold text-slate-800">Discussion de Classe</h2>
            <p className="text-xs text-slate-500">Posez vos questions sur le cours</p>
        </div>
        <div className="flex gap-2 items-center">
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors mr-2"
              title="Effacer l'historique de la conversation"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Effacer</span>
            </button>
            
            <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>

            <button
            onClick={() => {
                setUseFastLite(!useFastLite);
                if (!useFastLite) setUseThinking(false); // Mutual exclusion
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                useFastLite ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
            title="Utiliser le modèle Flash-Lite pour des réponses plus rapides (idéal pour définitions simples)"
            >
            <Zap size={14} className={useFastLite ? "fill-yellow-600" : ""} />
            <span className="hidden sm:inline">{useFastLite ? 'Mode Rapide' : 'Mode Standard'}</span>
            <span className="sm:hidden">Rapide</span>
            </button>

            <button
            onClick={() => {
                setUseThinking(!useThinking);
                if (!useThinking) setUseFastLite(false); // Mutual exclusion
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                useThinking ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
            title="Utiliser le mode réflexion approfondie pour les tâches complexes (Gemini 3 Pro + Thinking)"
            >
            <Brain size={14} className={useThinking ? "fill-purple-600" : ""} />
            <span className="hidden sm:inline">{useThinking ? 'Mode Réflexion' : 'Réflexion'}</span>
            <span className="sm:hidden">Réflexion</span>
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                >
                    {msg.content}
                </ReactMarkdown>
              </div>
              {msg.role === 'model' && (
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={() => playTTS(msg.content)}
                    disabled={isPlayingAudio}
                    className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    title="Lire à haute voix"
                  >
                   {isPlayingAudio ? <Loader2 className="animate-spin" size={14}/> : <Volume2 size={14} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
           <div className="flex justify-start">
             <div className="bg-slate-50 text-slate-500 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
               <Loader2 className="animate-spin" size={16} />
               <span className="text-sm">
                   {useThinking ? "L'enseignant analyse et réfléchit..." : "L'enseignant écrit..."}
               </span>
             </div>
           </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-white rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Posez votre question..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
