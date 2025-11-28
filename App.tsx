
import React, { useState } from 'react';
import { MessageSquare, Mic, Film, Settings as SettingsIcon, GraduationCap } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { LiveInterface } from './components/LiveInterface';
import { VideoLab } from './components/VideoLab';
import { Settings } from './components/Settings';
import { AppMode, TeacherSettings } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [settings, setSettings] = useState<TeacherSettings>({
    aideDevoirs: true,
    aideEvaluations: false,
    resources: [], // List of Resource objects
    userRole: 'eleve',
    classLevel: 'Secondaire inférieur',
    activeChapter: '',
    customInstructions: `1. POLITESSE : Si l'élève ne commence pas la conversation par une formule de politesse (Bonjour, Salut, etc.), refuse poliment de répondre à sa question et demande-lui de reformuler avec politesse.

2. ORTHOGRAPHE : Si le message de l'élève contient beaucoup de fautes d'orthographe :
   - Demande-lui de se relire et de corriger son texte.
   - Si l'élève a fait un effort pour corriger (même s'il reste quelques fautes) ou si c'est la deuxième fois qu'il essaie, accepte sa réponse pour ne pas le bloquer et réponds à sa question.
   - Ne sois pas trop sévère, le but est pédagogique.`
  });

  const renderContent = () => {
    switch (mode) {
      case AppMode.CHAT:
        return <ChatInterface settings={settings} />;
      case AppMode.LIVE_VOICE:
        return <LiveInterface settings={settings} />;
      case AppMode.VIDEO_LAB:
        return <VideoLab />;
      case AppMode.SETTINGS:
        return <Settings settings={settings} onUpdate={setSettings} />;
      default:
        return <ChatInterface settings={settings} />;
    }
  };

  const NavButton = ({ targetMode, icon: Icon, label }: { targetMode: AppMode, icon: any, label: string }) => (
    <button
      onClick={() => setMode(targetMode)}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${
        mode === targetMode 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium hidden md:block">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-20 md:w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <GraduationCap className="text-white" size={20} />
          </div>
          <h1 className="text-lg font-bold text-slate-800 hidden md:block">Professeur FWB</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavButton targetMode={AppMode.CHAT} icon={MessageSquare} label="Discussion" />
          <NavButton targetMode={AppMode.LIVE_VOICE} icon={Mic} label="Oral & Live" />
          {/* Video Lab removed temporarily */}
        </nav>

        <div className="p-4 border-t border-slate-100">
           <NavButton targetMode={AppMode.SETTINGS} icon={SettingsIcon} label="Paramètres" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-hidden h-full">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
