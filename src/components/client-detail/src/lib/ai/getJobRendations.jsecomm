import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export async function getJobRecommendations(req, clientProfile) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const prompt = `
You are an employment specialist AI.

Based on the following client profile, recommend 3–5 job titles.

Return:
- job title
- confidence score (0–100)
- short explanation (1 sentence)

Client Profile:
${JSON.stringify(clientProfile, null, 2)}

Respond ONLY in JSON:
[
  {
    "title": "",
    "confidence": 0,
    "reason": ""
  }
]
`;

    const response = await base44.ai.complete({
      prompt,
      max_tokens: 500,
      temperature: 0.3,
    });

    let text = response?.text || "[]";

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("AI parse error:", text);
      return [];
    }
  } catch (err) {
    console.error("getJobRecommendations error:", err);
    return [];
  }
}
