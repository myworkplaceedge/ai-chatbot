# SCORM / LearnWorlds Integration Guide

## iframe Embed

The simplest way to embed the AI Lesson Coach is via iframe using the `/embed` route.

### Basic HTML Snippet

```html
<iframe
  src="https://your-app.vercel.app/embed"
  width="100%"
  height="600"
  frameborder="0"
  allow="clipboard-write"
  style="border: none; border-radius: 12px; max-width: 700px;"
  title="AI Lesson Coach"
></iframe>
```

### With Lesson Pre-Selection

Use the `?lesson=` URL parameter to pre-select a topic:

```html
<iframe
  src="https://your-app.vercel.app/embed?lesson=feedback"
  width="100%"
  height="600"
  frameborder="0"
  title="AI Lesson Coach - Feedback"
></iframe>
```

### Widget Mode (Floating Button)

For a collapsible chat button overlay:

```html
<iframe
  src="https://your-app.vercel.app/widget"
  width="100%"
  height="100%"
  frameborder="0"
  style="position: fixed; bottom: 0; right: 0; width: 450px; height: 700px; border: none; z-index: 9999;"
  title="AI Lesson Coach Widget"
></iframe>
```

## URL Parameters Reference

| Parameter | Description | Example |
|-----------|-------------|---------|
| `lesson` | Pre-select a lesson topic | `?lesson=feedback` |

## CORS Requirements

The server must allow requests from the embedding domain. Configure allowed origins:

1. Set the `ALLOWED_ORIGINS` environment variable on the server:
```
ALLOWED_ORIGINS=https://your-lms.com,https://app.learnworlds.com
```

2. The server automatically allows:
   - `localhost:5173` (development)
   - `*.vercel.app` (Vercel deployments)
   - Any domain listed in `ALLOWED_ORIGINS`

## SCORM 1.2 / 2004 Integration

### Creating a SCORM Package

1. Create an HTML file that wraps the iframe:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AI Lesson Coach</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
    iframe { width: 100vw; height: 100vh; border: none; }
  </style>
</head>
<body>
  <iframe src="https://your-app.vercel.app/embed" title="AI Lesson Coach"></iframe>
</body>
</html>
```

2. Create an `imsmanifest.xml` file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="ai-lesson-coach"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="org1">
    <organization identifier="org1">
      <title>AI Lesson Coach</title>
      <item identifier="item1" identifierref="res1">
        <title>AI Lesson Coach</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
```

3. Package both files into a `.zip` file and upload to your LMS

### SCORM 2004 Package

For SCORM 2004, update the manifest namespace:
```xml
xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
```

## LearnWorlds Integration

### Custom Code Block

1. In your LearnWorlds course editor, add a **Custom Code** block
2. Paste the iframe embed snippet (see above)
3. Adjust the height to fit your course layout (recommended: 600px)

### Page Builder

1. Go to **Site Builder** > **Pages**
2. Add an HTML/Embed section
3. Paste the iframe code
4. Save and publish

## Troubleshooting

### CORS Errors
- Ensure the embedding domain is in `ALLOWED_ORIGINS` on the server
- Check browser console for the exact origin being blocked
- The server logs will show which origin was denied

### Sizing Issues
- The embed page is fully responsive and fills its container
- Set explicit width/height on the iframe for consistent sizing
- Use `max-width` to prevent the chat from being too wide on large screens

### Content Not Loading
- Verify the API server is running and accessible from the embedding domain
- Check that `VITE_API_URL` points to the correct server URL
- Ensure HTTPS is used in production (mixed content will be blocked)

## Security Considerations

- The embed route removes navigation chrome but maintains all safety features (content filter, escalation detection, PII redaction)
- The server sets `X-Frame-Options: ALLOWALL` and CSP `frame-ancestors` headers to allow embedding from approved domains
- No user authentication is required -- sessions are anonymous
- Consider restricting `ALLOWED_ORIGINS` to only your LMS domains in production
