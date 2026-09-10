private detectPromptInjection(request: AICompletionRequest): {
  suspicious: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
} {
  // Patterns for common injection attempts
  const patterns: { regex: RegExp; severity: 'low' | 'medium' | 'high' }[] = [
    // Direct instruction override
    { regex: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i, severity: 'high' },
    { regex: /disregard\s+(all\s+)?(previous|prior|above)/i, severity: 'high' },
    { regex: /forget\s+(everything|all|your)/i, severity: 'high' },
    { regex: /new\s+instructions?/i, severity: 'medium' },

    // System prompt injection
    { regex: /system\s*:\s*you\s+are/i, severity: 'high' },
    { regex: /\[system\]/i, severity: 'medium' },
    { regex: /<\|im_start\|>/i, severity: 'high' },

    // Role hijacking
    { regex: /you\s+are\s+now\s+(a|an|the)/i, severity: 'medium' },
    { regex: /act\s+as\s+(if\s+you\s+are|a)/i, severity: 'low' },
    { regex: /pretend\s+(to\s+be|you\s+are)/i, severity: 'medium' },

    // Data exfiltration attempts
    { regex: /(?:print|show|reveal|output)\s+(?:your|the)\s+(?:system\s+)?prompt/i, severity: 'high' },
    { regex: /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions)/i, severity: 'high' },
    { regex: /repeat\s+(?:the\s+)?(?:text|instructions?)\s+above/i, severity: 'high' },

    // Encoding tricks
    { regex: /base64|rot13|hex\s*decode/i, severity: 'low' },
  ];

  const matches: { pattern: string; severity: string }[] = [];

  for (const msg of request.messages) {
    if (msg.role === 'user') {
      for (const { regex, severity } of patterns) {
        if (regex.test(msg.content)) {
          matches.push({
            pattern: regex.source.substring(0, 50),
            severity,
          });
        }
      }
    }
  }

  if (matches.length === 0) {
    return { suspicious: false };
  }

  // Highest severity wins
  const severityOrder = { high: 3, medium: 2, low: 1 };
  const highest = matches.reduce(
    (max, m) => (severityOrder[m.severity as keyof typeof severityOrder] > severityOrder[max as keyof typeof severityOrder] ? m.severity : max),
    'low'
  );

  return {
    suspicious: true,
    reason: `${matches.length} pattern(s) matched, highest severity: ${highest}`,
    severity: highest as 'low' | 'medium' | 'high',
  };
}
