# Technical Report - AI Lesson Coach

## 1. Problem Statement

Communication skills training is a critical need in modern workplaces, yet traditional approaches (workshops, seminars, e-learning modules) suffer from poor retention, lack of personalization, and inability to provide on-demand practice opportunities. Learners need a scalable, always-available coaching tool that can help them apply communication skills to their specific real-world situations.

The AI Lesson Coach addresses this gap by providing an AI-powered chatbot that coaches learners using a structured three-beat response pattern (validate, teach, suggest practice), strictly grounded in Workplace Edge lesson content. The internal scaffolding framework that shapes this pattern is intentionally not surfaced to learners.

## 2. Data Sources

### Lesson Content

- **Format**: Microsoft Word `.docx` files uploaded by administrators
- **Extraction**: Mammoth library converts .docx to plain text, stripping formatting
- **Storage**: Full text stored in SQLite/Turso database via Prisma ORM
- **Scope**: Workplace Edge communication skills lessons covering feedback, boundaries, deadlines, task clarification, and general coaching

### Conversation Data

- **Sessions**: Anonymous CUID-based session IDs (no user accounts)
- **Messages**: Full conversation history stored for context continuity
- **Intent Logs**: Classification of each user message for analytics
- **Ratings**: Thumbs-up/down feedback on AI responses

## 3. Model and Approach

### LLM: Google Gemini 2.5 Flash

- Selected for fast response times, strong instruction-following, and built-in safety filters
- System instruction enforces a three-beat coaching structure (validate, teach, suggest practice) drawn from an internal scaffolding framework that is never named in responses
- Conversation history is sent with each request for context continuity

### Architecture Pattern: RAG-lite

Rather than traditional vector-based RAG, the system uses a keyword-based intent detection and lesson matching approach:

1. User message is classified by intent (8 types)
2. Relevant lessons are matched via token overlap scoring
3. Matched lesson content is injected into the Gemini system instruction
4. The LLM generates a response grounded in the provided lesson content

This approach was chosen for:

- Simplicity (no vector database or embedding model needed)
- Transparency (deterministic intent classification)
- Speed (no embedding computation step)

### Intent Detection Algorithm

- **8 intent types**: give_feedback, set_boundary, push_back_deadline, clarify_tasks, general_coaching, general, lesson_specific, off_topic
- **Scoring system**: Phrase matches (3x weight) > keyword matches > lesson title matches (6x weight)
- **Client override**: Users can manually select an intent via UI bubbles, bypassing auto-detection
- **Off-topic detection**: Comprehensive domain keyword list filters non-workplace queries

## 4. System Architecture

### Frontend (React + Vite)

```
src/
├── pages/
│   ├── ChatPage.tsx        # Main learner interface with welcome screen
│   ├── AdminPage.tsx       # Lesson management + analytics dashboard
│   ├── EmbedChatPage.tsx   # Minimal-chrome version for iframes
│   └── WidgetPage.tsx      # Collapsible floating widget
├── components/
│   ├── ChatMessage.tsx     # Message bubbles with markdown + ratings
│   ├── ChatInput.tsx       # Input with Enter-to-send
│   ├── ChatWidget.tsx      # Collapsible widget wrapper
│   ├── RolePlayToggle.tsx  # Practice mode toggle
│   ├── EscalationBanner.tsx # Sensitive topic warning
│   ├── AnalyticsDashboard.tsx # Admin stat cards + charts
│   ├── UploadZone.tsx      # Drag-and-drop file upload
│   ├── LessonsTable.tsx    # Lesson management table
│   ├── Toast.tsx           # Notification component
│   └── TypingIndicator.tsx # Loading animation
├── api.ts                  # Axios HTTP client
├── types.ts                # TypeScript interfaces
├── i18n.ts                 # Internationalization setup
└── locales/en.json         # English string translations
```

### Backend (Express + TypeScript)

```
server/src/
├── routes/
│   ├── chat.ts             # POST /api/chat - message handling
│   ├── upload.ts           # POST /api/upload - lesson upload
│   ├── lessons.ts          # GET/DELETE /api/lessons
│   ├── rating.ts           # POST /api/rating - thumbs up/down
│   └── analytics.ts        # GET /api/analytics - telemetry
├── lib/
│   ├── gemini.ts           # LLM integration + system prompts
│   ├── intent.ts           # Intent detection + lesson matching
│   ├── escalation.ts       # Sensitive topic detection
│   ├── contentFilter.ts    # Blocked content + PII detection
│   ├── privacy.ts          # PII stripping + session cleanup
│   └── db.ts               # Prisma client initialization
└── __tests__/              # Vitest test suite (35 tests)
```

### Database Schema (Prisma/SQLite)

- **Session**: Conversation sessions with timestamps
- **Message**: User and assistant messages with session foreign key
- **IntentLog**: Intent classification + matched docs per message
- **Rating**: Thumbs-up/down per assistant message
- **Lesson**: Uploaded lesson content (name + extracted text)

## 5. Intent Detection

### Supported Intents

| Intent             | Trigger                                  | Example                                       |
| ------------------ | ---------------------------------------- | --------------------------------------------- |
| give_feedback      | "give feedback", "constructive feedback" | "How do I give feedback to my manager?"       |
| set_boundary       | "set boundary", "say no"                 | "I need to set boundaries with my team"       |
| push_back_deadline | "push back", "deadline", "timeline"      | "How do I negotiate an unrealistic deadline?" |
| clarify_tasks      | "clarify", "expectations", "unclear"     | "My tasks are unclear, how do I ask?"         |
| general_coaching   | "coaching", "communication tips"         | "General advice on workplace communication"   |
| general            | Domain-relevant but no specific intent   | "Help with my coworker situation"             |
| lesson_specific    | Strong lesson title match                | Matched to specific uploaded lesson           |
| off_topic          | Non-workplace/non-communication          | "What's the weather?"                         |

### Matching Strategy

1. Tokenize user message (lowercase, split by non-alpha)
2. Score against each intent rule's phrases (3x) and keywords (1x)
3. Score against lesson titles (6x weight for direct name matches)
4. Select highest-scoring intent, with lesson_specific taking priority when score threshold met
5. Return matched lesson names for context injection

## 6. Safety and Guardrails

### Content Filter (`contentFilter.ts`)

- **Blocked topics**: Explicit content, violence, hate speech, malicious intent
- **PII detection (blocking)**: Email and phone number regex patterns — messages containing these are blocked before reaching the LLM
- **Behavior**: Blocked messages receive a safe redirect; filtered intent is logged

### Escalation Detection (`escalation.ts`)

- **Triggers**: Harassment, discrimination, self-harm, threats, mental health crisis, legal issues
- **Response**: Appends escalation message directing to HR/EAP
- **UI**: Amber warning banner displayed in chat

### PII Redaction (`privacy.ts`)

- **Applied to**: User messages before database storage (runs after the content filter)
- **Patterns**: Email, phone, SSN/SIN, and credit card numbers replaced with labeled tokens (`[EMAIL REDACTED]`, `[PHONE REDACTED]`, `[SSN/SIN REDACTED]`, `[CARD REDACTED]`)

### Knowledge Boundary

- System instruction restricts AI to only lesson content
- Off-topic questions are redirected back to lesson material
- HR disclaimer in both UI and system prompt

### Data Retention

- Sessions older than 30 days eligible for cleanup via `/api/cleanup`
- No user accounts or persistent identity tracking

## 7. Evaluation

### Test Coverage

- **34 unit tests** across 4 test files using Vitest
- Intent detection: 12 tests covering all intent types, edge cases, and client override
- Content filter: 8 tests for blocked content, PII detection, and clean messages
- Escalation: 8 tests for trigger conditions and non-triggers
- Privacy: 6 tests for PII stripping patterns

### Response Quality

- Three-beat coaching structure enforced in every response via system instruction; the internal framework name is never surfaced to the learner
- Follow-up questions generated for continued engagement
- Grade 7-8 reading level maintained per instruction

### Intent Detection Accuracy

- Correctly classifies 5 specific communication intents
- Robust off-topic detection with comprehensive domain keyword list
- Client intent override eliminates classification errors when users self-select

## 8. Limitations

1. **Keyword-based intent detection**: Not ML-based; may misclassify edge cases with ambiguous language
2. **English only**: UI strings extracted to i18n framework but only English translations provided
3. **No user authentication**: Anyone with the URL can access chat and admin pages
4. **Single LLM provider**: Depends on Google Gemini availability and API limits
5. **No conversation memory across sessions**: Each session is independent
6. **Hallucination risk**: Despite grounding instructions, LLM may occasionally generate content not in lessons
7. **File format limitation**: Only `.docx` supported; no PDF, plain text, or other formats

## 9. Future Improvements

1. **ML-based intent detection** using fine-tuned classification model
2. **Vector-based RAG** with embeddings for more precise lesson matching
3. **Multi-language support** with complete translations
4. **User authentication** with role-based access control
5. **Advanced analytics** with conversation quality metrics and learner progress tracking
6. **PDF and plain text** lesson upload support
7. **Conversation export** as PDF transcripts
8. **LLM provider abstraction** to support OpenAI, Anthropic, etc.
9. **Automated evaluation** pipeline for response quality scoring
10. **Mobile app** or PWA for offline-capable coaching
