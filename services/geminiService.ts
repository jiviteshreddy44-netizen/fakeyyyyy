
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, Verdict, TextAnalysisResult } from "../types.ts";

const extractJson = (text: string) => {
  try {
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text);
    throw new Error("The forensic engine returned an unreadable response format.");
  }
};

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  // Correct Initialization: always use a named parameter {apiKey}
  return new GoogleGenAI({ apiKey });
};

export const generateSyntheticImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from model");
};

export const generateSyntheticVideo = async (prompt: string): Promise<string> => {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed.");
  
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const reverseSignalGrounding = async (file: File): Promise<any> => {
  const ai = getAI();
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: "Find the original source of this image using Google Search. Return JSON: {summary, originalEvent, manipulationDetected, confidence, findings: [{type, detail}]}" }
      ]
    },
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    }
  });

  // Extracting text from GenerateContentResponse using .text property
  const data = extractJson(response.text || "{}");
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => (chunk as any).web)
    .map(chunk => ({ title: (chunk as any).web?.title || "Verified Source", url: (chunk as any).web?.uri || "" })) || [];

  return { ...data, sources };
};

export const analyzeMedia = async (file: File, metadata: any): Promise<AnalysisResult> => {
  const ai = getAI();
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: "Forensic analysis: Output JSON with verdict (REAL/LIKELY_FAKE), deepfakeProbability (0-100), confidence (0-100), summary, explanations (array: {point, detail, category, timestamp}), userRecommendation." }
      ]
    },
    config: {
      responseMimeType: "application/json"
    }
  });

  const data = extractJson(response.text || "{}");
  
  return {
    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
    timestamp: Date.now(),
    verdict: (data.deepfakeProbability > 50 || data.verdict === 'LIKELY_FAKE') ? Verdict.LIKELY_FAKE : Verdict.REAL,
    confidence: data.confidence ?? 50,
    confidenceLevel: (data.confidence > 85 ? 'High' : data.confidence < 50 ? 'Low' : 'Medium') as any,
    deepfakeProbability: data.deepfakeProbability ?? 50,
    summary: data.summary || "Analysis complete.",
    userRecommendation: data.userRecommendation || "Review findings manually.",
    analysisSteps: data.analysisSteps || {
      integrity: { score: 50, explanation: "Analyzing...", confidenceQualifier: "Medium" },
      consistency: { score: 50, explanation: "Analyzing...", confidenceQualifier: "Medium" },
      aiPatterns: { score: 50, explanation: "Analyzing...", confidenceQualifier: "Medium" },
      temporal: { score: 50, explanation: "Analyzing...", confidenceQualifier: "Medium" }
    },
    explanations: data.explanations || [],
    manipulationType: data.manipulationType || "Neural Synthesis",
    guidance: data.guidance || "Proceed with caution.",
    fileMetadata: metadata
  };
};

export const startAssistantChat = () => {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: "You are FAKEY-AI Forensic Assistant. Use Google Search for news/facts. Help users interpret deepfake scores and forensic data.",
      tools: [{ googleSearch: {} }]
    }
  });
};

// Fix for components/TextInterrogator.tsx error: added analyzeText
export const analyzeText = async (text: string, mode: 'AI_DETECT' | 'FACT_CHECK'): Promise<any> => {
  const ai = getAI();
  const isFactCheck = mode === 'FACT_CHECK';
  const response = await ai.models.generateContent({
    model: isFactCheck ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
    contents: text,
    config: {
      responseMimeType: "application/json",
      tools: isFactCheck ? [{ googleSearch: {} }] : undefined,
      systemInstruction: isFactCheck 
        ? "Verify claims using Google Search. Return JSON with 'claims' array and 'summary'. Each claim has 'status', 'claim', 'sourceUrl'."
        : "Detect AI-generated text. Return JSON with 'aiProbability', 'verdictLabel', 'aiSignals', 'summary'."
    }
  });
  
  const data = extractJson(response.text || "{}");
  if (isFactCheck && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
    data.sources = response.candidates[0].groundingMetadata.groundingChunks
      .filter(chunk => (chunk as any).web)
      .map(chunk => ({
        title: (chunk as any).web.title,
        url: (chunk as any).web.uri
      }));
  }
  return data;
};

// Fix for components/AudioLab.tsx error: added transcribeAudio
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const ai = getAI();
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(audioBlob);
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: audioBlob.type, data: base64Data } },
        { text: "Transcribe the audio exactly. Output the text only." }
      ]
    }
  });
  return response.text || "";
};

// Fix for JudicialReport.tsx and BatchTriage.tsx error: added generateForensicCertificate
export const generateForensicCertificate = async (result: AnalysisResult): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a formal forensic analysis certificate for this data: ${JSON.stringify(result)}. Include file name, verdict, probability scores, and detailed anomaly descriptions.`
  });
  return response.text || "Forensic report generation failed.";
};
