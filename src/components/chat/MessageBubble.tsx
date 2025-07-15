'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Message } from '@/types';
import { processMessageUrls } from '@/lib/media-detection';
import { cn } from '@/lib/utils';
import { AlertCircle, Bot, ExternalLink, User } from 'lucide-react';
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from '@/components/ui/chat-bubble';

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
        className="inline-flex items-center gap-1 text-primary hover:underline"
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
            style={{ width: 'auto', height: 'auto' }}
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
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {url}
        </a>
      );
  }
}

export default function MessageBubble({ message }: { message: Message }) {
  const [mediaTypes, setMediaTypes] = useState<Array<{ url: string; type: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  
  useEffect(() => {
    async function detectMedia() {
      if (message.content) {
        setIsProcessing(true);
          const types = await processMessageUrls(message.content);
          setMediaTypes(types);
        setIsProcessing(false);
      } else {
          setIsProcessing(false);
      }
    }
    detectMedia();
  }, [message.content]);
  
  const isUser = message.role === 'user';
  const variant = isUser ? 'sent' : 'received';

  const AvatarIcon = isUser ? User : Bot;
  
  return (
    <ChatBubble variant={variant}>
      <ChatBubbleAvatar
        fallback={<AvatarIcon className="h-4 w-4" />}
      />
      <div className="flex flex-col gap-1 w-full max-w-[80%]">
        <ChatBubbleMessage variant={variant}>
        {message.error && (
            <div className="flex items-center gap-2 text-red-500 text-sm mb-2">
            <AlertCircle className="h-4 w-4" />
            Error: {message.error}
          </div>
        )}
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        
          {(mediaTypes.length > 0) && (
          <div className="space-y-2 mt-3">
            {mediaTypes.map((media, index) => (
              <div key={index} className="space-y-1">
                <MediaItem url={media.url} type={media.type} />
              </div>
            ))}
          </div>
        )}
        </ChatBubbleMessage>
        <div
          className={cn(
            'text-xs text-muted-foreground',
            isUser && 'self-end'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </ChatBubble>
  );
}