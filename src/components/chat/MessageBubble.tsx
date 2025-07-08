'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Message } from '@/types';
import { processMessageUrls } from '@/lib/media-detection';
import { cn } from '@/lib/utils';
import { AlertCircle, ExternalLink } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

interface MediaItemProps {
  url: string;
  type: string;
}

function MediaItem({ url, type }: MediaItemProps) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-holly-accent hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        {url}
      </a>
    );
  }
  
  switch (type) {
    case 'image':
      return (
        <div className="relative max-w-full max-h-64 rounded-lg cursor-pointer overflow-hidden">
          <Image
            src={url}
            alt="Shared image"
            width={400}
            height={256}
            className="object-contain w-full h-auto max-h-64 rounded-lg"
            onClick={() => window.open(url, '_blank')}
            onError={() => setHasError(true)}
          />
        </div>
      );
    
    case 'video':
      return (
        <video
          src={url}
          controls
          className="max-w-full max-h-64 rounded-lg"
          onError={() => setHasError(true)}
        />
      );
    
    case 'audio':
      return (
        <audio
          src={url}
          controls
          className="max-w-full"
          onError={() => setHasError(true)}
        />
      );
    
    default:
      return (
        <a 
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-holly-accent hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {url}
        </a>
      );
  }
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [mediaTypes, setMediaTypes] = useState<Array<{ url: string; type: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    async function detectMedia() {
      if (message.content) {
        setIsProcessing(true);
        try {
          const types = await processMessageUrls(message.content);
          setMediaTypes(types);
        } catch (error) {
          console.error('Error processing media URLs:', error);
        } finally {
          setIsProcessing(false);
        }
      }
    }
    
    detectMedia();
  }, [message.content]);
  
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-lg p-3 space-y-2",
        isUser 
          ? "bg-holly-accent text-white" 
          : "bg-card border border-border"
      )}>
        {message.error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            Error: {message.error}
          </div>
        )}
        
        <div className="whitespace-pre-wrap text-sm">
          {message.content}
        </div>
        
        {(mediaTypes.length > 0 || isProcessing) && (
          <div className="space-y-2 mt-3">
            {isProcessing && (
              <div className="text-xs text-muted-foreground">
                Processing media...
              </div>
            )}
            
            {mediaTypes.map((media, index) => (
              <div key={index} className="space-y-1">
                <MediaItem url={media.url} type={media.type} />
              </div>
            ))}
          </div>
        )}
        
        <div className={cn(
          "text-xs",
          isUser ? "text-white/70" : "text-muted-foreground"
        )}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}