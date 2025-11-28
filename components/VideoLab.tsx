
import React from 'react';
import { Film } from 'lucide-react';

export const VideoLab: React.FC = () => {
  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-slate-500">
        <Film size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-slate-700">Module Vidéo</h2>
        <p className="mt-2">Cette fonctionnalité est temporairement désactivée.</p>
    </div>
  );
};
