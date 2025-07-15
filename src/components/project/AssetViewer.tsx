"use client";

import { useChatStore } from "@/store";
import CircularGallery from "@/components/ui/CircularGallery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AssetViewerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AssetViewer({ isOpen, onOpenChange }: AssetViewerProps) {
  const { currentProject } = useChatStore();

  const finalImages = currentProject?.assets?.final_images || [];
  const imageCandidates = currentProject?.assets?.image_candidates || [];

  // Use final images if available, otherwise fall back to candidates.
  const sourceImages = finalImages.length > 0 ? finalImages : imageCandidates;

  // Correctly map the source images to the format expected by the gallery.
  let galleryItems = sourceImages.map((img: any) => ({
    image: img.url, // Access the 'url' property of the image object.
    text: `Scene ${img.scene_index}`, // Access the 'scene_index' for the label.
  }));


  // The gallery component needs a good number of items to loop correctly.
  // If we have very few, we should duplicate them to ensure the seamless effect.
  const MIN_ITEMS = 10;
  if (galleryItems.length > 0 && galleryItems.length < MIN_ITEMS) {
    const originalItems = [...galleryItems];
    while (galleryItems.length < MIN_ITEMS) {
      galleryItems = galleryItems.concat(originalItems);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] h-[80vh] sm:max-w-[70vw] p-0 border-0">
        <div className="w-full h-full bg-black/80 backdrop-blur-sm flex flex-col">
          <DialogHeader className="p-4 text-left">
            <DialogTitle className="text-white">Assets Gallery</DialogTitle>
            <DialogDescription className="text-white/70 text-sm">
              Scroll, drag, or use your mouse wheel to navigate the gallery.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full h-full relative">
            {galleryItems.length > 0 ? (
              <CircularGallery 
                items={galleryItems} 
                textColor="white"
                bend={2}
                />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                No images generated yet.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 