'use client';

import { useChatStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Circle, 
  Plus, 
  Image as ImageIcon,
  FileText,
  Users,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronRight,
  Palette,
  Video,
  Mic,
  Clapperboard,
  Target,
  Package,
  Folder,
  LayoutDashboard,
  Wallet,
  Camera,
  Film,
  Sparkles,
  Settings,
  UserCheck,
  Layers,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import AssetViewer from '../project/AssetViewer';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '@/components/ui/sidebar';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../theme/ThemeToggle';

const Logo = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        Holly Studio
      </motion.span>
    </div>
  );
};

const LogoIcon = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20">
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </div>
  );
};


const SidebarContent = () => {
  const { open } = useSidebar();
  const { currentProject, createNewProject } = useChatStore();
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    consistency: true,
    progress: true,
    assets: true,
  });
  const [isAssetViewerOpen, setIsAssetViewerOpen] = useState(false);
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  if (!currentProject) {
    return <div className="p-4">No active project. Create one to begin.</div>;
  }
  
  // All the data processing logic from the original component
  const stateData = (currentProject.assets as any) || {};
  const checklistData = (Array.isArray(currentProject.checklist) ? {} : currentProject.checklist) as any || {};
  const budgetData = currentProject.budget || { spent: 0, total: 15 };
  const currentPhase = currentProject.phase || stateData.phase || 'initial';
  const currentStepInfo = stateData.current_step_info || null;
  const consistencyFlags = (currentProject as any).consistency_flags || {};



  // Updated phase mapping to include consistency_setup
  const phaseMapping: { [key: string]: string } = {
    consistency_setup: 'consistency_complete',
    idea_review: 'idea_approved',
    script_generation: 'script_approved',
    script_review: 'script_approved',
    image_generation: 'images_approved',
    image_review: 'images_approved',
    narration_generation: 'narration_generated',
    video_generation: 'video_clips_generated',
    assembly: 'assembly_complete',
  };
  const currentProgressKey = phaseMapping[currentPhase];

  // Updated progress items to include consistency step
  const progressItems = [
    { key: 'idea_approved', label: 'Idea', icon: Sparkles, completed: checklistData.idea_approved || false },
    { key: 'consistency_complete', label: 'Consistency', icon: Settings, completed: checklistData.consistency_complete || false },
    { key: 'script_approved', label: 'Script', icon: FileText, completed: checklistData.script_approved || false },
    { key: 'images_approved', label: 'Images', icon: Camera, completed: checklistData.images_approved || false },
    { key: 'narration_generated', label: 'Narration', icon: Mic, completed: checklistData.narration_generated || false },
    { key: 'video_clips_generated', label: 'Video Clips', icon: Film, completed: checklistData.video_clips_generated || false },
    { key: 'assembly_complete', label: 'Final Assembly', icon: Clapperboard, completed: checklistData.assembly_complete || false }
  ];

  const completedCount = progressItems.filter(item => item.completed).length;
  const progressPercentage = (completedCount / progressItems.length) * 100;

  // PRODUCTION FIX: Intelligent image aggregation
  // Show final_images first, then fall back to image_candidates for approved images
  const finalImages = stateData.final_images || [];
  const imageCandidates = stateData.image_candidates || [];
  
  // If no final_images, use image_candidates as approved images
  // This handles the case where n8n workflow hasn't moved approved images yet
  const displayImages = finalImages.length > 0 ? finalImages : imageCandidates;
  
  const videoClips = (currentProject.assets as any)?.video_clips || [];
  const narrationClips = (currentProject.assets as any)?.narration_clips || [];
  const references = stateData.references || [];
  const styleProfile = stateData.style_profile;

  // Production Debug: Show what images are being displayed
  console.log('🎬 Sidebar Image Display Logic:', {
    final_images_count: finalImages.length,
    image_candidates_count: imageCandidates.length,
    displaying: displayImages.length > 0 ? 'Images found' : 'No images',
    display_source: finalImages.length > 0 ? 'final_images' : 'image_candidates',
    project_id: currentProject.project_id
  });

  const videoThumbnails = videoClips.map((clip: { url: string; scene_index: number }) => {
    const matchingImage = displayImages.find((img: any) => img.scene_index === clip.scene_index);
    return {
      videoUrl: clip.url,
      thumbnailUrl: matchingImage?.url,
      sceneIndex: clip.scene_index,
    };
  });
  
  return (
    <>
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto overflow-x-hidden pr-2">
        {/* Current Step Info */}
        {open && currentStepInfo?.pending_question && (
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-900/50 dark:to-orange-900/50 mb-4 shrink-0">
            <CardHeader className="p-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Clock className="h-4 w-4" />
              Next Step
            </CardTitle>
          </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-sm text-amber-800 dark:text-amber-200">
              {currentStepInfo.pending_question}
            </p>
          </CardContent>
        </Card>
      )}
      
        {/* Project Overview Section */}
        <CollapsibleSection title="Overview" icon={LayoutDashboard} sectionKey="overview" expandedSections={expandedSections} toggleSection={toggleSection}>
          <div className="text-xs text-muted-foreground space-y-3">
            <InfoItem icon={Target} label="Core Idea" value={stateData.core_idea} />
            <InfoItem icon={Users} label="Target Audience" value={stateData.target_audience} />
            <InfoItem icon={Palette} label="Visual Style" value={stateData.visual_style} />
          </div>
        </CollapsibleSection>

        {/* Consistency Setup Section */}
        {(styleProfile || references.length > 0) && (
          <CollapsibleSection title="Consistency" icon={Layers} sectionKey="consistency" expandedSections={expandedSections} toggleSection={toggleSection}>
            <div className="text-xs text-muted-foreground space-y-3">
              {styleProfile && (
                <InfoItem icon={Palette} label="Style Profile" value={styleProfile} />
            )}
              {references.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">References</span>
                  </div>
                  <div className="space-y-2 ml-5">
                    {references.map((ref: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                        <div className="flex-shrink-0">
                          <Image
                            src={ref.image_url}
                            alt={`Reference image for ${ref.asset_id}: ${ref.description}`}
                            width={40}
                            height={40}
                            className="rounded-md object-cover"
                            style={{ width: 'auto', height: 'auto' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-xs">{ref.asset_id}</p>
                          <p className="text-muted-foreground text-xs truncate">{ref.description}</p>
                        </div>
                </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Progress Checklist Section */}
        <CollapsibleSection title="Progress" icon={CheckCircle} sectionKey="progress" expandedSections={expandedSections} toggleSection={toggleSection}>
          <div className="space-y-3">
             <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
               <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${progressPercentage}%` }} />
              </div>
             {progressItems.map(item => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                    {item.completed ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    {item.key === currentProgressKey && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">Current</Badge>
                      )}
                    </div>
             ))}
          </div>
        </CollapsibleSection>

        {/* Assets Gallery Section */}
        <CollapsibleSection title="Assets" icon={Package} sectionKey="assets" expandedSections={expandedSections} toggleSection={toggleSection}>
          <div className="space-y-4">
            {displayImages.length > 0 && (
              <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">IMAGES</h4>
                  <Button onClick={() => setIsAssetViewerOpen(true)} variant="outline" size="sm" className="w-full">View Image Gallery</Button>
                <div className="grid grid-cols-3 gap-2">
                    {displayImages.slice(0, 6).map((image: any, idx: number) => (
                      <Image
                        key={idx}
                        src={image.url}
                        alt={`Generated image ${idx + 1} for scene ${image.scene_index || idx + 1}`}
                        width={100}
                        height={100}
                        className="rounded-md object-cover aspect-square"
                        style={{ width: 'auto', height: 'auto' }}
                      />
                  ))}
                </div>
              </div>
              )}
            
            {videoThumbnails.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">VIDEOS</h4>
                <div className="grid grid-cols-3 gap-2">
                  {videoThumbnails.map((video: any, idx: number) => (
                    <a href={video.videoUrl} key={idx} target="_blank" rel="noopener noreferrer" className="relative group aspect-square">
                        <Image
                        src={video.thumbnailUrl || '/placeholder.png'}
                        alt={`Video thumbnail for scene ${video.sceneIndex}, click to play video`}
                          width={100}
                          height={100}
                        className="rounded-md object-cover aspect-square bg-muted"
                        style={{ width: 'auto', height: 'auto' }}
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Film className="h-6 w-6 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {narrationClips.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">NARRATION</h4>
                    <div className="space-y-1">
                        {narrationClips.map((audio: any, idx: number) => (
                            <a 
                                href={audio.url} 
                                key={idx} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                            >
                                <Mic className="h-3.5 w-3.5" />
                                <span>{`Narration Clip ${idx + 1}`}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
      <AssetViewer isOpen={isAssetViewerOpen} onOpenChange={setIsAssetViewerOpen} />
    </>
  );
};

const CollapsibleSection = ({ title, icon: Icon, sectionKey, expandedSections, toggleSection, children }: any) => {
  const { open } = useSidebar();
  const isExpanded = expandedSections[sectionKey];

  if (!open) {
    return (
        <div className="flex items-center justify-center py-2">
            <Icon className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
        </div>
    );
  }

  return (
    <div className="flex flex-col">
        <div 
            className="flex items-center justify-between cursor-pointer py-2"
            onClick={() => toggleSection(sectionKey)}
        >
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{title}</h3>
            </div>
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        {isExpanded && <div className="pl-6 pt-2 pb-2 border-l border-neutral-200 dark:border-neutral-700">{children}</div>}
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value }: any) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2">
            <Icon className="h-3 w-3 mt-0.5 text-muted-foreground" />
            <div className="flex flex-col">
                <span className="font-semibold text-foreground">{label}</span>
                <p className="text-muted-foreground">{value}</p>
            </div>
        </div>
    );
};


export default function ModernSidebar() {
  const { createNewProject } = useChatStore();

  const handleNewProject = () => {
    if (confirm('Are you sure you want to start a new project? This will save your current progress.')) {
      createNewProject();
    }
  };

  return (
    <Sidebar>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="shrink-0">
             <SidebarLink link={{ href: "#", label: "Holly Studio", icon: <LogoIcon /> }} />
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <button onClick={handleNewProject} className="w-full">
              <SidebarLink link={{ href: "#", label: "New Project", icon: <Plus className="h-5 w-5" /> }} />
            </button>
          </div>
          <div className="mt-4 flex-grow overflow-y-auto">
            <SidebarContent />
          </div>
        </div>
        
        <div className="shrink-0">
          <SidebarLink link={{ href: "#", label: "Theme", icon: <ThemeToggle /> }} />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}