# AI Lesson Coach - Stakeholder Presentation

---

## Slide 1: The Problem

**Communication skills training doesn't stick.**

- Workshops are one-time events with poor retention
- E-learning modules are passive -- no practice or personalization
- Learners can't get on-demand coaching when they actually need it
- Managers lack time to individually coach each team member

**Result**: Billions spent on training, but workplace communication issues persist.

---

## Slide 2: Our Solution

**AI Lesson Coach** -- an intelligent chatbot that coaches learners using their own course materials.

- Admins upload Workplace Edge lesson plans (.docx)
- The AI answers **only** from those materials -- no hallucinated advice
- Every response follows a structured three-beat coaching flow (validate, teach, suggest practice), shaped by an internal scaffolding framework that learners never see named
- Learners can practice with **role-play scenarios**
- Available 24/7, anywhere, on any device

---

## Slide 3: Demo Walkthrough

### Learner Experience
1. **Welcome screen** with topic cards (Give Feedback, Set Boundaries, etc.)
2. **Conversational coaching** with a three-beat structure (validate, teach, suggest practice)
3. **Follow-up prompts** as clickable chips for deeper learning
4. **Practice Mode** -- AI acts as a difficult coworker for 2 turns, then provides feedback
5. **Rate responses** with thumbs-up/down

### Admin Experience
1. **Upload lessons** via drag-and-drop (.docx)
2. **Manage content** -- view and delete lessons
3. **Analytics dashboard** -- session counts, intent distribution, satisfaction scores, popular lessons

---

## Slide 4: Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌──────────────┐
│  React Frontend │──API──│  Express Server   │──LLM──│ Google Gemini│
│  (Vite + TS)    │       │  (TypeScript)     │       │ (2.5 Flash)  │
└─────────────────┘       └────────┬───────────┘       └──────────────┘
                                   │
                          ┌────────┴────────┐
                          │  SQLite / Turso  │
                          │  (Prisma ORM)    │
                          └─────────────────┘
```

**Key design decisions:**
- Monorepo with separate frontend/backend packages
- Keyword-based intent detection (fast, transparent, no ML infra needed)
- Anonymous sessions (CUID-based, no user accounts)
- Lesson content injected as system instruction (not RAG with embeddings)

---

## Slide 5: Safety and Privacy

### Content Safety
- **Pre-LLM content filter** blocks explicit, violent, and hateful content
- **Escalation detection** for harassment, self-harm, discrimination, legal issues
- **Knowledge boundary** -- AI only answers from uploaded lessons
- **HR disclaimer** in UI and system prompt

### Privacy
- **No user accounts** -- fully anonymous sessions
- **PII auto-redaction** -- emails, phones, SSN, credit cards stripped before storage
- **30-day data retention** -- automatic session cleanup
- **No tracking** -- no cookies, fingerprints, or persistent identifiers

### Gemini Safety
- Google's built-in safety filters provide an additional protection layer

---

## Slide 6: Evaluation Results

### Test Coverage
- **34 automated tests** across intent detection, content filter, escalation, and privacy
- All tests passing in CI

### Quality Metrics
- **Three-beat structure compliance**: Enforced in 100% of coaching responses via system instruction; internal framework vocabulary is never surfaced to learners
- **Follow-up generation**: Every response ends with an actionable practice question
- **Rating system**: Thumbs-up/down tracking for ongoing quality monitoring

### Intent Detection
- 5 specific communication skill intents + general/off-topic classification
- Client intent override for guaranteed accuracy when user self-selects

---

## Slide 7: Embed Options

### iframe Embed (SCORM/LMS)
```html
<iframe src="https://app.vercel.app/embed" height="600"></iframe>
```

### Floating Widget
```html
<iframe src="https://app.vercel.app/widget"></iframe>
```

### Supported Platforms
- SCORM 1.2 and 2004 packages
- LearnWorlds custom code blocks
- Any LMS that supports iframe embedding
- Standalone web deployment

---

## Slide 8: Limitations and Future Work

### Current Limitations
- Keyword-based intent detection (not ML)
- English only (i18n framework ready)
- No user authentication
- .docx only (no PDF support)
- Single LLM provider (Gemini)

### Planned Improvements
- ML-based intent classification
- Vector-based RAG for better lesson matching
- Multi-language support
- User authentication with roles
- Advanced analytics and learner progress tracking
- Mobile app / PWA
- LLM provider abstraction (OpenAI, Anthropic support)

---

## Slide 9: Q&A

**Key links:**
- Repository: github.com/Gurehmat/AI-Chatbot
- Tech Report: docs/TECHNICAL_REPORT.md
- Ethical Analysis: docs/ETHICAL_ANALYSIS.md
- User Guide: docs/USER_GUIDE.md
- Admin Guide: docs/ADMIN_GUIDE.md
