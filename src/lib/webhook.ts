import { WebhookRequest, WebhookResponse } from '@/types';

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://placeholder-webhook.com';

export async function sendWebhookMessage(request: WebhookRequest): Promise<WebhookResponse> {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}