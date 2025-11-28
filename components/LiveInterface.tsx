import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Radio, AlertCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MODELS } from '../constants';
import { TeacherSettings } from '../types';
import { float32ToPCM16, decodeAudioData, arrayBufferToBase64 } from '../services/audioUtils';
import { buildSystemInstruction } from '../services/geminiService';

interface LiveInterfaceProps {
  settings: TeacherSettings;
}

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ settings }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for audio handling to avoid re-renders closing connections
  const sessionRef = useRef<any>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanup = () => {
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e){}
        sessionRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    // Close both contexts to prevent "Max AudioContexts" error
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }
    if (outputContextRef.current) {
        outputContextRef.current.close();
        outputContextRef.current = null;
    }

    audioSourcesRef.current.forEach(s => {
        try { s.stop(); } catch(e){}
    });
    audioSourcesRef.current.clear();
    setIsConnected(false);
  };

  useEffect(() => {
    return cleanup;
  }, []);

  const startSession = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Votre navigateur ne supporte pas l'accès audio.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Audio Contexts - Create new ones for the session
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 }); // Input needs 16k
      const outputCtx = new AudioContextClass({ sampleRate: 24000 }); // Output is 24k
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      // Input Stream
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        console.error("Microphone permission error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new Error("Accès au microphone refusé. Veuillez vérifier les permissions de votre navigateur (icône cadenas dans la barre d'adresse).");
        }
        throw err;
      }
      streamRef.current = stream;

      const connectPromise = ai.live.connect({
        model: MODELS.LIVE_AUDIO,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: buildSystemInstruction(settings) + 
            "\n\nNOTE: Nous sommes en mode conversation orale. Sois concis, encourageant et naturel. Corrige la prononciation si nécessaire."
        },
        callbacks: {
            onopen: () => {
                console.log("Live session opened");
                setIsConnected(true);
                
                // Start Audio Pipeline
                const source = inputCtx.createMediaStreamSource(stream);
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                
                processor.onaudioprocess = (e) => {
                    if (isMuted) return;
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcm16 = float32ToPCM16(inputData);
                    const base64Data = arrayBufferToBase64(pcm16);
                    
                    connectPromise.then(session => {
                        session.sendRealtimeInput({
                            media: {
                                mimeType: 'audio/pcm;rate=16000',
                                data: base64Data
                            }
                        });
                    });
                };

                source.connect(processor);
                processor.connect(inputCtx.destination);
                
                sourceRef.current = source;
                processorRef.current = processor;
            },
            onmessage: async (msg: LiveServerMessage) => {
                const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio) {
                    const binary = atob(base64Audio);
                    const bytes = new Uint8Array(binary.length);
                    for(let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    
                    // Decode using the active output context
                    const audioBuffer = await decodeAudioData(
                        bytes, 
                        outputCtx, 
                        24000, 
                        1
                    );
                    
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputCtx.destination);
                    
                    const currentTime = outputCtx.currentTime;
                    const startTime = Math.max(nextStartTimeRef.current, currentTime);
                    
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;
                    
                    audioSourcesRef.current.add(source);
                    source.onended = () => audioSourcesRef.current.delete(source);
                }
                
                if (msg.serverContent?.interrupted) {
                    audioSourcesRef.current.forEach(s => s.stop());
                    audioSourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                }
            },
            onclose: () => {
                console.log("Session closed");
                setIsConnected(false);
            },
            onerror: (e) => {
                console.error("Session error", e);
                // Often 403 Forbidden is treated as an error event here
                setError("Erreur de connexion Live API. Vérifiez votre clé API ou les permissions.");
                setIsConnected(false);
            }
        }
      });
      
      sessionRef.current = await connectPromise;

    } catch (err: any) {
      console.error("Start session error:", err);
      setError(err.message || "Impossible de démarrer la session audio.");
      cleanup();
    }
  };

  const toggleConnection = () => {
    if (isConnected) {
        cleanup();
    } else {
        startSession();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900 rounded-lg text-white p-8 relative overflow-hidden">
        {isConnected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-64 h-64 bg-blue-500 rounded-full opacity-10 animate-ping"></div>
                 <div className="w-48 h-48 bg-blue-500 rounded-full opacity-20 animate-pulse absolute"></div>
            </div>
        )}

        <div className="z-10 flex flex-col items-center gap-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                isConnected ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-slate-700'
            }`}>
                <Radio size={40} className={isConnected ? "animate-pulse" : "text-slate-400"} />
            </div>

            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                    {isConnected ? "Conversation en cours" : "Pratique Orale"}
                </h2>
                <p className="text-slate-400 max-w-sm">
                    {isConnected 
                        ? "Parlez naturellement. L'enseignant vous écoute." 
                        : "Démarrez une session audio en direct pour pratiquer votre prononciation ou poser des questions oralement."}
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/30 px-4 py-2 rounded-lg text-sm max-w-md text-center">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex gap-4 mt-4">
                <button 
                    onClick={toggleConnection}
                    className={`px-8 py-3 rounded-full font-semibold transition-all ${
                        isConnected 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/25'
                    }`}
                >
                    {isConnected ? 'Terminer la session' : 'Démarrer la discussion'}
                </button>
                
                {isConnected && (
                     <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-3 rounded-full transition-colors ${
                            isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                        title={isMuted ? "Réactiver le micro" : "Couper le micro"}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};