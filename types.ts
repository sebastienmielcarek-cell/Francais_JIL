
export type UserRole = 'eleve' | 'professeur' | 'admin';

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isLoading?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  chapter: string;
  content: string;
}

export interface TeacherSettings {
  aideDevoirs: boolean;
  aideEvaluations: boolean;
  resources: Resource[]; 
  userRole: UserRole;
  classLevel: string;
  activeChapter: string; // Optional: to focus on a specific chapter
  customInstructions: string; // Specific behavioral rules (politeness, spelling, etc.)
}

export enum AppMode {
  CHAT = 'CHAT',
  LIVE_VOICE = 'LIVE_VOICE',
  VIDEO_LAB = 'VIDEO_LAB',
  SETTINGS = 'SETTINGS'
}

export interface VideoGenerationState {
  isGenerating: boolean;
  statusMessage: string;
  videoUrl: string | null;
  error: string | null;
}