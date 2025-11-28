
import React, { useState, useCallback } from 'react';
import { TeacherSettings, UserRole, Resource } from '../types';
import { Trash2, Plus, FileText, Folder, UploadCloud, X, MessageSquareWarning, Sparkles, Loader2 } from 'lucide-react';
import { generateDocumentExamples } from '../services/geminiService';

interface SettingsProps {
  settings: TeacherSettings;
  onUpdate: (newSettings: TeacherSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  // Local state for new resource form
  const [newResTitle, setNewResTitle] = useState('');
  const [newResChapter, setNewResChapter] = useState('');
  const [newResContent, setNewResContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // State for enriching resources
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const handleChange = (key: keyof TeacherSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  const handleAddResource = () => {
    if (!newResTitle || !newResContent) return;
    
    const newResource: Resource = {
        id: Date.now().toString(),
        title: newResTitle,
        chapter: newResChapter || 'Général',
        content: newResContent
    };

    onUpdate({
        ...settings,
        resources: [...settings.resources, newResource]
    });

    // Reset form
    setNewResTitle('');
    setNewResContent('');
    // Keep chapter for convenience if adding multiple docs to same chapter
    setShowAddForm(false);
  };

  const handleDeleteResource = (id: string) => {
    onUpdate({
        ...settings,
        resources: settings.resources.filter(r => r.id !== id)
    });
  };

  const handleEnrichResource = async (res: Resource) => {
    if (enrichingId) return; // Prevent multiple concurrent requests
    setEnrichingId(res.id);

    try {
        const examples = await generateDocumentExamples(res.content);
        if (examples) {
            const updatedResources = settings.resources.map(r => {
                if (r.id === res.id) {
                    return {
                        ...r,
                        content: r.content + "\n\n--- EXEMPLES GÉNÉRÉS PAR L'IA ---\n" + examples
                    };
                }
                return r;
            });
            onUpdate({ ...settings, resources: updatedResources });
        }
    } catch (e) {
        console.error("Failed to enrich resource", e);
    } finally {
        setEnrichingId(null);
    }
  };

  // Drag and Drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        const file = files[0];
        setNewResTitle(file.name);
        if (!newResChapter) setNewResChapter('Général');

        // Attempt to read file content
        try {
            // Check if text file
            if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|csv|xml)$/i)) {
                const text = await file.text();
                setNewResContent(text);
            } else {
                // Placeholder for binaries in this demo environment
                setNewResContent(`[Fichier importé : ${file.name}]\n\n(Le contenu de ce type de fichier ne peut pas être extrait directement dans cette démo. Veuillez copier/coller le texte ici si nécessaire.)`);
            }
        } catch (err) {
            console.error("Error reading file:", err);
            setNewResContent("Erreur lors de la lecture du fichier.");
        }
        
        setShowAddForm(true);
    }
  }, [newResChapter]);


  // Group resources for display
  const resourcesByChapter: Record<string, Resource[]> = {};
  settings.resources.forEach(r => {
      const chap = r.chapter;
      if (!resourcesByChapter[chap]) resourcesByChapter[chap] = [];
      resourcesByChapter[chap].push(r);
  });

  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-slate-200 p-6 overflow-y-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Paramètres de l'Enseignant</h2>

      <div className="space-y-8 max-w-4xl">
        {/* Role & Context */}
        <section className="space-y-4">
          <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Contexte & Rôle</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Rôle de l'utilisateur (Simulation)</label>
                <select 
                    value={settings.userRole}
                    onChange={(e) => handleChange('userRole', e.target.value as UserRole)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                >
                    <option value="eleve">Élève</option>
                    <option value="professeur">Professeur</option>
                    <option value="admin">Administrateur</option>
                </select>
             </div>

             <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Niveau de la classe</label>
                <input
                    type="text"
                    value={settings.classLevel}
                    onChange={(e) => handleChange('classLevel', e.target.value)}
                    placeholder="Ex: 4ème secondaire"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
             </div>
          </div>
        </section>

        {/* Permissions */}
        <section className="space-y-4">
          <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Permissions Élève</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                    <span className="block font-medium text-slate-900 text-sm">Aide aux devoirs</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={settings.aideDevoirs}
                    onChange={(e) => handleChange('aideDevoirs', e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                    <span className="block font-medium text-slate-900 text-sm">Aide aux évaluations</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={settings.aideEvaluations}
                    onChange={(e) => handleChange('aideEvaluations', e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
            </div>
          </div>
        </section>

        {/* Behavioral Instructions */}
        <section className="space-y-4">
           <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
               Consignes Comportementales
               <MessageSquareWarning size={16} className="text-orange-500" />
           </h3>
           <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Règles de discipline, politesse et orthographe</label>
                <textarea
                    value={settings.customInstructions}
                    onChange={(e) => handleChange('customInstructions', e.target.value)}
                    placeholder="Ex: Si l'élève ne dit pas 'Bonjour', ne pas répondre..."
                    className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm leading-relaxed"
                />
                <p className="text-xs text-slate-500 bg-blue-50 p-2 rounded border border-blue-100">
                    Ces consignes permettent de définir le "cadre" de la classe virtuelle. L'IA vérifiera ces critères avant de répondre au fond de la question.
                </p>
           </div>
        </section>

        {/* Resources Management */}
        <section className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-md font-semibold text-slate-700">Documents & Ressources</h3>
                <button 
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700"
                >
                    <Plus size={16} /> Ajouter un document
                </button>
            </div>
            
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Chapitre Cible (Focus)</label>
                <select 
                    value={settings.activeChapter}
                    onChange={(e) => handleChange('activeChapter', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                >
                    <option value="">Tous les chapitres (Aucun focus)</option>
                    {Object.keys(resourcesByChapter).map(chap => (
                        <option key={chap} value={chap}>{chap}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-500">Sélectionnez un chapitre pour dire à l'IA de se concentrer spécifiquement sur celui-ci.</p>
            </div>

            {/* Drop Zone */}
            {!showAddForm && (
                <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer
                        ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 bg-white'}`}
                    onClick={() => setShowAddForm(true)}
                >
                    <UploadCloud size={40} className={isDragging ? "text-blue-500" : "text-slate-400"} />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                        {isDragging ? "Déposez le fichier ici..." : "Glissez-déposez vos fichiers ici"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        ou cliquez pour ajouter manuellement (PDF, Word, Texte)
                    </p>
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-slate-50 p-4 rounded-lg border border-blue-200 space-y-3 animate-in fade-in slide-in-from-top-2 relative">
                     <button 
                        onClick={() => setShowAddForm(false)} 
                        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="Titre du document (ex: Cours sur la lumière)"
                            value={newResTitle}
                            onChange={(e) => setNewResTitle(e.target.value)}
                            className="p-2 border border-slate-300 rounded text-sm w-full"
                        />
                        <input
                            type="text"
                            placeholder="Chapitre / Dossier (ex: Physique - Optique)"
                            value={newResChapter}
                            onChange={(e) => setNewResChapter(e.target.value)}
                            className="p-2 border border-slate-300 rounded text-sm w-full"
                        />
                    </div>
                    <textarea
                        placeholder="Contenu du document (Copiez/Collez le texte ici ou résultat OCR)..."
                        value={newResContent}
                        onChange={(e) => setNewResContent(e.target.value)}
                        className="w-full h-32 p-2 border border-slate-300 rounded text-sm font-mono resize-y"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAddForm(false)} className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-200 rounded">Annuler</button>
                        <button onClick={handleAddResource} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Enregistrer</button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-4 mt-4">
                {Object.keys(resourcesByChapter).length === 0 ? (
                    !showAddForm && <p className="text-sm text-slate-400 italic text-center py-4">Aucune ressource ajoutée pour le moment.</p>
                ) : (
                    Object.entries(resourcesByChapter).map(([chapter, items]) => (
                        <div key={chapter} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 flex items-center gap-2 font-medium text-slate-700 text-sm">
                                <Folder size={16} className="text-blue-500" />
                                {chapter}
                            </div>
                            <div className="divide-y divide-slate-100">
                                {items.map(res => (
                                    <div key={res.id} className="p-3 bg-white flex justify-between items-start group hover:bg-slate-50 transition-colors">
                                        <div className="flex gap-3">
                                            <FileText size={18} className="text-slate-400 mt-1" />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{res.title}</div>
                                                <div className="text-xs text-slate-500 line-clamp-1 max-w-md">{res.content.substring(0, 100)}...</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleEnrichResource(res)}
                                                disabled={enrichingId === res.id}
                                                className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs font-medium border
                                                    ${enrichingId === res.id 
                                                        ? 'bg-purple-100 text-purple-700 border-purple-200 cursor-wait' 
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200'
                                                    }`}
                                                title="Générer et ajouter des exemples concrets via l'IA"
                                            >
                                                {enrichingId === res.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Sparkles size={14} />
                                                )}
                                                {enrichingId === res.id ? "Génération..." : "Enrichir (Exemples)"}
                                            </button>

                                            <button 
                                                onClick={() => handleDeleteResource(res.id)}
                                                className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
      </div>
    </div>
  );
};
