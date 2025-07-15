# Holly Studio MVP

A premium-minimal web interface for creative projects powered by the Holly n8n agent.

## Features

- 🎨 **Premium Design** - Clean, minimal interface with custom theme tokens
- 💬 **Real-time Chat** - Natural conversation interface with Holly
- 🖼️ **Media Support** - Automatic inline rendering of images, videos, and audio
- 📱 **Responsive** - Works seamlessly on desktop and mobile
- 🌓 **Dark/Light Mode** - Theme toggle with system preference detection
- 💾 **State Persistence** - Resume projects exactly where you left off
- 🎯 **Project Management** - Multiple projects with local storage
- ⚡ **Long-task UX** - Smart loading states for complex operations
- 🚨 **Error Handling** - Graceful error handling with toast notifications

## Tech Stack

- **Next.js 14** with App Router
- **React 18** with TypeScript
- **TailwindCSS** with custom theme tokens
- **shadcn/ui** component library
- **Zustand** for state management
- **TanStack Query** for API management
- **Supabase** for data persistence
- **next-themes** for theme management

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (optional, works without for MVP)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd holly-studio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your credentials:
   ```env
   # Supabase Configuration (required for long operations)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   
   # n8n Webhook URL (required for full functionality)
   NEXT_PUBLIC_N8N_WEBHOOK_URL=https://pranaut.app.n8n.cloud/webhook/7a117d41-8c93-4293-a378-34f037b14087
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Visit [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Starting a New Project

1. Click "New Project" on the welcome screen
2. Start typing your message to begin conversation with Holly
3. Your project state is automatically saved locally

### Resuming Projects

1. Select from recent projects on the welcome screen
2. Your chat history and project state will be restored
3. Continue exactly where you left off

### Media Handling

Holly Studio automatically detects and renders:
- **Images**: JPG, PNG, WebP, GIF, SVG
- **Videos**: MP4, WebM, OGG, MOV, AVI  
- **Audio**: MP3, WAV, OGG, M4A, FLAC

URLs are automatically detected in messages and rendered inline.

### Long Tasks

When Holly is processing complex operations (like video rendering):
- A spinner appears immediately
- After 5 seconds, a banner explains long task behavior
- Operations can take up to 20 minutes
- The interface remains responsive throughout

**Hybrid Monitoring System:**
- **Quick Operations** (0-2 minutes): Direct webhook polling for immediate responses
- **Long Operations** (2+ minutes): Database polling fallback for operations like video generation
- **Resilient Design**: Survives gateway timeouts and infrastructure issues
- **Smart Detection**: Monitors both AI responses and asset changes for completion
- **Debug Mode**: Comprehensive logging shows exactly what the system is detecting

**Monitoring Phases:**
1. **Phase 1** (0-30s): Fast polling at 500ms intervals
2. **Phase 2** (30s-2min): Medium polling at 2s intervals  
3. **Phase 3** (2min+): Database polling every 15s with detailed state analysis

## Architecture

### Component Structure

```
src/
├── app/                    # Next.js app router pages
├── components/
│   ├── chat/              # Chat-related components
│   │   ├── ChatComposer.tsx
│   │   ├── ChatLog.tsx
│   │   ├── ChatPage.tsx
│   │   ├── MessageBubble.tsx
│   │   └── Sidebar.tsx
│   ├── project/           # Project management
│   │   └── ProjectGate.tsx
│   ├── theme/             # Theme management
│   │   ├── ThemeProvider.tsx
│   │   └── ThemeToggle.tsx
│   └── ui/                # shadcn/ui components
├── lib/                   # Utilities and configurations
│   ├── media-detection.ts
│   ├── supabase.ts
│   ├── utils.ts
│   └── webhook.ts
├── store/                 # Zustand store
│   └── index.ts
└── types/                 # TypeScript definitions
    └── index.ts
```

### Data Flow

1. **User Input** → ChatComposer → Webhook API
2. **Webhook Response** → MessageBubble → Media Detection
3. **State Updates** → Zustand Store → Local Storage
4. **Project Restoration** → Supabase → Store Hydration

## Customization

### Theme Tokens

Custom theme tokens are defined in `src/app/globals.css`:

```css
:root {
  --holly-bg: #F7F7F7;           /* Light background */
  --holly-fg: #111111;           /* Text color */
  --holly-accent: #0F7BFF;       /* Primary accent */
  --holly-accent-muted: #E5F0FF; /* Subtle accent */
}
```

### Component Styling

All components use Tailwind classes with the custom theme tokens:
- `bg-holly-bg` for backgrounds
- `text-holly-fg` for text
- `bg-holly-accent` for primary elements
- `bg-holly-accent-muted` for subtle elements

## Development

### Adding New Features

1. Create components in appropriate directories
2. Update TypeScript types in `src/types/`
3. Add to Zustand store if state management needed
4. Follow existing patterns for styling and structure

### Environment Setup

The app works without environment variables using placeholder values:
- Supabase functionality is disabled gracefully
- Webhook calls will fail but UI remains functional
- Perfect for development and testing

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Holly Studio MVP and follows the project's licensing terms.

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.
