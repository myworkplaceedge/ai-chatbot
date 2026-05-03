# Admin Guide - AI Lesson Coach

## Accessing the Admin Panel

Navigate to `/admin` on your deployment URL (e.g., `https://your-app.vercel.app/admin`).

## Uploading Lessons

1. In the **Upload Lesson Plan** section, drag and drop a `.docx` file onto the upload zone, or click to browse
2. Only `.docx` (Word) files are supported, with a maximum size of 25MB
3. Click **Upload Lesson** to process the file
4. The system extracts plain text from the document and stores it for the AI to reference

### Supported File Format

- **Microsoft Word (.docx)** only
- The system uses Mammoth to extract text content, so formatting (bold, tables, images) is stripped -- only the text content is used
- Name your files descriptively (e.g., "Giving Feedback.docx") as the filename becomes the lesson title shown in analytics

## Managing Lessons

The **Uploaded Lessons** table shows all lessons with:
- Lesson name (from the original filename)
- Upload date and time
- Delete button

To remove a lesson, click the **Delete** button next to it. This removes the lesson content from the database. The AI will no longer reference it in responses.

## Analytics Dashboard

Below the lessons table, the **Analytics** section shows:

### Stat Cards
- **Total Sessions** -- Number of chat conversations started
- **Avg Messages / Session** -- How engaged learners are
- **Total Ratings** -- Number of thumbs-up/down ratings received
- **Satisfaction** -- Percentage of thumbs-up ratings

### Intent Distribution
A bar chart showing which coaching topics learners ask about most frequently. Use this to understand what skills learners need the most help with.

### Most Used Lessons
A bar chart showing which uploaded lesson documents are referenced most often. Helps identify which content is most valuable.

## Data Retention

- Sessions older than 30 days are eligible for automatic cleanup
- PII (emails, phone numbers, SSN/SIN, credit card numbers) is automatically redacted from stored messages
- The `/api/cleanup` endpoint can be called to trigger session cleanup

## Embedding the Chat

The chat can be embedded in external platforms:
- **iframe embed**: Use the `/embed` route for a minimal-chrome version
- **Floating widget**: Use the `/widget` route for a collapsible chat button
- See [SCORM Integration Guide](SCORM_INTEGRATION.md) for LMS setup
