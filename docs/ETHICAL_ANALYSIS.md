# Ethical Analysis - AI Lesson Coach

## 1. Bias Risks

### Cultural Bias

- The AI coaching advice is grounded in Workplace Edge lesson content, which reflects Western workplace norms. Communication styles that are effective in one culture may be inappropriate in another.
- **Mitigation**: The system only coaches from uploaded lesson content, so instructors can adapt materials to their cultural context. The i18n framework is in place for future multilingual support.

### Linguistic Bias

- The system currently operates in English only. Non-native English speakers may receive less effective coaching due to the keyword-based intent detection system not recognizing variations in phrasing.
- **Mitigation**: Intent detection uses broad keyword lists and phrase matching. The i18n framework (react-i18next) is configured and ready for translation files. Future work includes multilingual lesson support.

### LLM Training Data Bias

- Google Gemini's training data may contain biases around workplace dynamics, gender roles, and authority structures that could surface in coaching advice.
- **Mitigation**: The system instruction strictly constrains responses to lesson content, reducing the LLM's reliance on its training data. The Spark-Shift-Stretch framework provides a consistent structure that limits free-form advice.

## 2. Privacy Safeguards

### Anonymous Sessions

- Sessions use CUID-based identifiers with no connection to real user identities
- No user accounts, login, or registration required
- No cookies or persistent tracking beyond the browser session

### PII Protection

- **Automated detection**: Regex patterns identify emails, phone numbers, SSN/SIN, and credit card numbers
- **Redaction before storage**: PII is stripped from user messages before database insertion using `[REDACTED]` tokens
- The original unredacted text is sent to the LLM for response quality but is never persisted

### Data Retention

- Sessions older than 30 days are eligible for deletion via the cleanup endpoint
- No indefinite data retention
- Message content is stored for conversation continuity only

### What Is Stored

- Session ID (anonymous CUID)
- Message content (PII-redacted)
- Intent classification
- Matched lesson names
- Rating values (thumbs up/down)
- Timestamps

### What Is NOT Stored

- User names, emails, or identifying information
- IP addresses
- Browser fingerprints
- Location data

## 3. Guardrails

### Content Filter

- **Pre-LLM filtering**: User input is checked before being sent to Gemini
- **Blocked categories**: Explicit content, violence, hate speech, malicious intent
- **Behavior**: Blocked messages receive a generic redirect response; the LLM is never called
- **Logging**: Filtered messages are logged with intent `filtered:<reason>` (for example, `filtered:email address`) for audit purposes

### Knowledge Boundary Enforcement

- The system instruction explicitly constrains the AI to only use uploaded lesson content
- Off-topic questions are redirected: "I can only help with the lesson material"
- No internet access, external tools, or knowledge outside lesson content
- Domain keyword list detects non-workplace queries for immediate redirection

### Off-Topic Redirection

- Intent detection classifies messages as "off_topic" when they don't match workplace communication patterns
- The AI politely redirects users back to lesson-relevant questions

## 4. Escalation Rules

### When to Hand Off to a Human

The system detects six categories of sensitive topics that require human support:

| Category             | Example Triggers                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Harassment           | "harassment", "being harassed", "sexual harassment", "hostile work environment", "retaliation", "assault" |
| Discrimination       | "discrimination", "racism", "sexism", "ageism", "treated unfairly because"                                |
| Mental Health Crisis | "mental health crisis", "panic attack", "can't cope", "breaking down"                                     |
| Self-Harm            | "self-harm", "suicidal", "want to die", "hurt myself", "end my life"                                      |
| Threats              | "threat", "violence", "unsafe work", "safety violation", "unsafe conditions"                              |
| Legal Issues         | "lawyer", "legal action", "filing a complaint", "wrongful termination", "EEOC"                            |

### Escalation Response

When triggered:

1. The AI still provides its coaching response (for the non-sensitive part of the query)
2. An escalation message is appended: "This sounds important -- please reach out to your HR department, manager, or Employee Assistance Program (EAP)."
3. A prominent amber warning banner is displayed in the chat UI
4. The intent is logged as "escalated" for analytics

### Limitations

- Keyword-based detection may miss nuanced expressions of distress
- May over-trigger on benign uses of keywords (e.g., discussing workplace harassment policies for a lesson)
- Cannot replace professional crisis intervention

## 5. Gemini Safety Filters

### Built-in LLM Safety

Google Gemini includes built-in safety filters for:

- Sexually explicit content
- Hate speech
- Harassment
- Dangerous content

These operate independently of our custom content filter, providing a second layer of protection.

### Custom Filtering Layer

Our content filter operates before the LLM call, providing:

- Domain-specific blocked topic detection
- PII detection and flagging
- Faster rejection of clearly inappropriate content (no LLM API call needed)

## 6. Data Handling

### Storage Architecture

- **Database**: SQLite (development) / Turso LibSQL (production)
- **ORM**: Prisma with typed schema
- **Encryption**: Turso provides encryption at rest; SQLite relies on filesystem permissions

### Data Flow

```
User Message
  → Content Filter (block if inappropriate)
  → PII Stripping (redact personal data)
  → Store redacted message
  → Intent Detection (classify topic)
  → Lesson Matching (find relevant content)
  → Gemini API (generate response with original message)
  → Store AI response
  → Return to user
```

### Deletion Capabilities

- Individual lessons can be deleted by admins via the admin panel
- Session cleanup removes all data older than 30 days (messages, intents, sessions)
- No data export functionality (by design, to minimize data exposure)

## 7. Recommendations for Production Deployment

### Additional Safeguards

1. **Rate limiting**: Add per-IP or per-session rate limits to prevent abuse
2. **User authentication**: Implement role-based access (learner vs. admin)
3. **Audit logging**: Log all admin actions (uploads, deletions) with timestamps
4. **Content moderation queue**: Flag and review escalated conversations
5. **Regular review cycles**: Monthly review of filtered/escalated messages to tune detection

### Monitoring

1. Track escalation frequency to identify systemic issues
2. Monitor content filter false-positive rate
3. Review low-rated responses for quality improvement
4. Alert on unusual usage patterns (high message volume, repeated blocked attempts)

### Compliance

1. Add a privacy policy page accessible from the chat interface
2. Implement data export/deletion endpoints for GDPR compliance if deployed in EU
3. Document data processing activities for privacy impact assessments
4. Consider SOC 2 compliance for enterprise deployments
