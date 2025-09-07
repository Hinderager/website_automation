# My Website Automator

A Next.js application for automated website content generation using Anthropic's Claude AI.

## Setup

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Anthropic API Configuration
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Freepik API Configuration
FREEPIK_WEBHOOK_SECRET=deda085cd8f9f6f02dcf8a6c28ecde82
FREEPIK_IMAGE_MODEL=imagen nano banana
FREEPIK_ASPECT_RATIO=original

# Google API Configuration
GOOGLE_DOC_URL=https://docs.google.com/document/d/e/2PACX-1vQ1AgoSsHbr-Q5KrZ9I76WULb4vXJYkIR7ztkSdnF7pw_MG3Ji0Lss9qDthDP6QZ_bx1aQQiaFEsvCU/pub

# Application Configuration (Optional)
APP_PASSWORD=your_app_password_here
ORIGIN_ALLOWLIST=localhost:3000,yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Getting Your Anthropic API Key

1. Visit [Anthropic's Console](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

### Installation

```bash
npm install
```

### Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Features

- AI-powered content generation using Anthropic's Claude
- Support for different content flows (with/without subtopics)
- Google Docs integration for content classification
- Competitor analysis integration
- Automated generation of titles, descriptions, FAQs, and more
- **Global API Key Management** - Centralized configuration for all API keys
- **Debug Endpoint** - Check API key status and validation
- **Startup Validation** - Automatic validation of all required keys

## Quick Setup

Run the setup script to automatically create your `.env.local` file with all API keys:

```bash
npm run setup-env
```

This will create a `.env.local` file with your Anthropic API key and all other required configuration.

## API Key Management

The application uses a centralized API key management system located in `lib/apiKeys.ts`. This provides:

- **Centralized Configuration**: All API keys managed in one place
- **Validation**: Automatic validation of required vs optional keys
- **Type Safety**: TypeScript interfaces for all key configurations
- **Error Handling**: Clear error messages for missing keys
- **Debug Support**: Easy debugging of key status

### Debug API Keys

Visit `/api/debug` to check the status of all your API keys and see validation results.
