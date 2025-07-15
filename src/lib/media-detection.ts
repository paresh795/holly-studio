import { MediaType } from '@/types';

// Improved URL regex that handles common edge cases like trailing brackets, periods, etc.
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\\^`\[\]]+)/g;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|avi)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac)$/i;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  
  // Clean up URLs by removing common trailing punctuation
  return matches.map(url => {
    // Remove trailing punctuation that's likely not part of the URL
    return url.replace(/[.,;:!?)\]}>]*$/, '');
  });
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
      signal: AbortSignal.timeout(3000),
      mode: 'cors',
      cache: 'no-cache'
    });
    
    // For Supabase and other external URLs, if HEAD fails, use URL detection
    if (!response.ok) {
      console.debug(`HEAD request failed for ${url}: ${response.status}, using URL fallback`);
      return { url, type: detectMediaType(url) };
    }
    
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
  } catch (error) {
    // Silently fallback to URL-based detection for failed requests
    console.debug(`Using URL-based media detection for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
    return { url, type: detectMediaType(url) };
  }
}

export async function processMessageUrls(content: string): Promise<MediaType[]> {
  const urls = extractUrls(content);
  
  // Use Promise.allSettled to handle individual failures gracefully
  const mediaPromises = urls.map(url => detectMediaTypeFromHeaders(url));
  
  try {
    const results = await Promise.allSettled(mediaPromises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Fallback for individual failures
        console.debug(`Media detection failed for ${urls[index]}, using URL fallback`);
        return { url: urls[index], type: detectMediaType(urls[index]) };
      }
    });
  } catch (error) {
    // Ultimate fallback to extension detection for all URLs
    console.debug('Media detection completely failed, using URL fallback for all:', error instanceof Error ? error.message : 'Unknown error');
    return urls.map(url => ({ url, type: detectMediaType(url) }));
  }
}