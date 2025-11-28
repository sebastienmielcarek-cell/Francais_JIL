
import { GoogleGenAI, Modality } from "@google/genai";
import { MODELS, DEFAULT_TEACHER_PROMPT } from "../constants";
import { TeacherSettings, Resource } from "../types";
import { decodeAudioData } from "./audioUtils";

// Helper to get fresh client with current key
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTextResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  lastMessage: string,
  settings: TeacherSettings,
  useLiteModel: boolean = false,
  useThinking: boolean = false
): Promise<string> => {
  const ai = getAIClient();
  
  // Determine model: Thinking takes priority, then Lite, then Default Pro
  let modelName = MODELS.CHAT_PRO;
  if (useLiteModel) modelName = MODELS.FAST_LITE;
  if (useThinking) modelName = MODELS.CHAT_PRO;
  
  const systemInstruction = buildSystemInstruction(settings);

  // Filter out system messages from history if any (API handles system via config)
  const validHistory = history.map(h => ({
    role: h.role === 'model' ? 'model' : 'user',
    parts: h.parts
  }));

  const config: any = {
      systemInstruction: systemInstruction,
  };

  // Thinking Mode Configuration
  if (useThinking) {
      config.thinkingConfig = { thinkingBudget: 32768 };
  }

  const chat = ai.chats.create({
    model: modelName,
    history: validHistory,
    config: config,
  });

  const response = await chat.sendMessage({ message: lastMessage });
  return response.text || "Désolé, je n'ai pas pu générer de réponse.";
};

export const generateDocumentExamples = async (content: string): Promise<string> => {
    const ai = getAIClient();
    try {
        const response = await ai.models.generateContent({
            model: MODELS.CHAT_PRO, // Use Pro for high quality pedagogical examples
            contents: `Tu es un expert pédagogique. Voici un extrait de cours :
            
            "${content}"
            
            Tâche : Génère 2 à 3 exemples concrets, variés et détaillés pour illustrer les concepts présents dans ce texte. 
            Ces exemples doivent aider un élève à mieux comprendre par la pratique ou l'analogie.
            
            Format de sortie : Retourne uniquement les exemples, formatés clairement (ex: "Exemple concret 1 : ..."), sans texte d'introduction inutile.`,
        });
        return response.text || "";
    } catch (e) {
        console.error("Error generating examples:", e);
        return "";
    }
};

export const generateTTS = async (text: string): Promise<AudioBuffer | null> => {
  const ai = getAIClient();
  let audioContext: AudioContext | null = null;
  try {
    const response = await ai.models.generateContent({
      model: MODELS.TTS,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Friendly female-sounding voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Use the shared decoder for consistency
    const buffer = await decodeAudioData(bytes, audioContext, 24000, 1);
    
    // CRITICAL: Close the context used for decoding to avoid "Max AudioContexts" error/leak
    await audioContext.close();
    
    return buffer;

  } catch (error) {
    console.error("TTS Error:", error);
    if (audioContext) {
        try { await audioContext.close(); } catch(e){}
    }
    return null;
  }
};

export const reformulateDocumentContent = async (content: string, targetLevel: string): Promise<string> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: MODELS.CHAT_PRO,
      contents: `Tu es un expert pédagogique. Voici un contenu de cours :
      
      "${content}"
      
      Tâche : Reformule et simplifie ce contenu pour le rendre accessible à un niveau "${targetLevel}".
      Utilise un langage clair, des phrases simples et une structure aérée. Conserve le sens original mais rend-le plus digeste.
      Ajoute une mention "[Contenu reformulé pour niveau ${targetLevel}]" au début.`,
    });
    return response.text || "";
  } catch (e) {
    console.error("Error reformulating content:", e);
    return "";
  }
};

export function buildSystemInstruction(settings: TeacherSettings): string {
    const { userRole, classLevel, aideDevoirs, aideEvaluations, resources, activeChapter, customInstructions } = settings;

    // Group resources by chapter
    const resourcesByChapter: Record<string, Resource[]> = {};
    const priorityIds: string[] = [];

    resources.forEach(r => {
        const chap = r.chapter.trim() || "Général";
        if (!resourcesByChapter[chap]) resourcesByChapter[chap] = [];
        resourcesByChapter[chap].push(r);

        // If activeChapter is set, collect IDs of resources in that chapter
        if (activeChapter && chap === activeChapter) {
            priorityIds.push(r.id);
        }
    });

    let resourcesText = "";
    if (Object.keys(resourcesByChapter).length === 0) {
        resourcesText = "Aucune ressource spécifique fournie.";
    } else {
        for (const [chapter, docs] of Object.entries(resourcesByChapter)) {
            const isPriority = activeChapter === chapter;
            resourcesText += `\n[CHAPITRE/DOSSIER: ${chapter}]${isPriority ? " (CIBLE PRIORITAIRE)" : ""}\n`;
            docs.forEach(doc => {
                resourcesText += `-- Document (ID: ${doc.id}): ${doc.title}\n`;
                resourcesText += `   Contenu: ${doc.content}\n`;
            });
        }
    }

    // Construct the parameter block similar to the JSON structure provided in requirements
    const parametersBlock = `
PARAMÈTRES DE LA SESSION:
{
  "role_utilisateur": "${userRole}",
  "aide_devoirs_autorisee": ${aideDevoirs},
  "aide_evaluations_autorisee": ${aideEvaluations},
  "chapitre_cible": "${activeChapter || ''}",
  "id_ressources_prof": ${JSON.stringify(priorityIds)},
  "niveau_classe": "${classLevel}"
}
`;

    // Add custom instructions block if present
    const customInstructionsBlock = customInstructions 
        ? `\nCONSIGNES DISCIPLINAIRES ET COMPORTEMENTALES SPÉCIFIQUES (À APPLIQUER AVANT TOUTE RÉPONSE):\n${customInstructions}\n`
        : "";

    return `${DEFAULT_TEACHER_PROMPT}

${parametersBlock}

${customInstructionsBlock}

RESSOURCES ENSEIGNANT (Documents sources):
Tu dois baser tes réponses prioritairement sur les contenus ci-dessous.
${resourcesText}

LOGIQUE DE COMPORTEMENT:
1. Si role_utilisateur="eleve":
   - APPLIQUE D'ABORD les Consignes Disciplinaires et Comportementales ci-dessus. Si une règle n'est pas respectée (ex: politesse), interviens immédiatement.
   - Si les règles sont respectées, aide selon les flags aide_devoirs/aide_evaluations.
   - Si un "chapitre_cible" est défini, concentre-toi sur les documents de ce chapitre.
2. Si role_utilisateur="professeur":
   - Agis comme un collègue (scénarios, adaptations).
3. Si role_utilisateur="admin":
   - Support technique/global.
`;
}
