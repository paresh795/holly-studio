import { MediaType } from '@/types';

const URL_REGEX = /(https?:\/\/\S+)/g;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|avi)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac)$/i;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

export function detectMediaType(url: string): 'image' | 'video' | 'audio' | 'link' {
  if (IMAGE_EXTENSIONS.test(url)) return 'image';
  if (VIDEO_EXTENSIONS.test(url)) return 'video';
  if (AUDIO_EXTENSIONS.test(url)) return 'audio';
  return 'link';
}

export async function detectMediaTypeFromHeaders(url: string): Promise<MediaType> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(3000)
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    let type: 'image' | 'video' | 'audio' | 'link' = 'link';
    
    if (contentType.startsWith('image/')) {
      type = 'image';
    } else if (contentType.startsWith('video/')) {
      type = 'video';
    } else if (contentType.startsWith('audio/')) {
      type = 'audio';
    } else {
      // Fallback to extension detection
      type = detectMediaType(url);
    }
    
    return { url, type, contentType };
  } catch {
    // Fallback to extension detection
    return { url, type: detectMediaType(url) };
  }
}

export async function processMessageUrls(content: string): Promise<MediaType[]> {
  const urls = extractUrls(content);
  
  const mediaPromises = urls.map(url => detectMediaTypeFromHeaders(url));
  
  try {
    const mediaTypes = await Promise.all(mediaPromises);
    return mediaTypes;
  } catch {
    // Fallback to extension detection for all URLs
    return urls.map(url => ({ url, type: detectMediaType(url) }));
  }
}