import type { AnalysisConfidence, EvidenceWeights, Refinement } from "@/lib/schemas";

export function calculateConfidence(input: {
  identification: number; lyrics: number; music: number; contextCount: number; artistStatementCount: number; transcription?: number;
}): AnalysisConfidence {
  const externalContext = Math.min(1, input.contextCount * 0.18 + input.artistStatementCount * 0.24);
  const sources = [input.lyrics, input.music, externalContext, input.identification].filter((v) => v > 0.05);
  const average = sources.reduce((sum, value) => sum + value, 0) / Math.max(1, sources.length);
  return {
    songIdentification: input.identification,
    lyrics: input.lyrics,
    transcription: input.transcription ?? 0,
    musicalAnalysis: input.music,
    externalContext,
    overallInterpretation: Math.min(0.96, average * 0.82 + Math.min(sources.length, 4) * 0.035),
  };
}

export function calculateEvidenceWeights(confidence: AnalysisConfidence, hasUserGuidance: boolean, balance: Refinement["balance"]): EvidenceWeights {
  const raw: EvidenceWeights = {
    lyrics: confidence.lyrics * 0.55,
    music: confidence.musicalAnalysis * (confidence.lyrics < 0.2 ? 1.15 : 0.65),
    externalContext: confidence.externalContext * 0.28,
    artistStatements: confidence.externalContext * 0.22,
    userGuidance: hasUserGuidance ? (confidence.lyrics < 0.2 ? 0.45 : 0.18) : 0,
  };
  const boost: Record<Refinement["balance"], keyof EvidenceWeights | null> = { balanced: null, lyrics: "lyrics", music: "music", context: "externalContext", personal: "userGuidance" };
  const target = boost[balance];
  if (target) raw[target] *= 2.4;
  if (target === "externalContext") raw.artistStatements *= 1.6;
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  const normalized = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total])) as EvidenceWeights;
  const correction = 1 - Object.values(normalized).reduce((sum, value) => sum + value, 0);
  normalized.music += correction;
  return normalized;
}

export function fallbackLevel(confidence: AnalysisConfidence) {
  if (confidence.songIdentification >= 0.7 && confidence.lyrics >= 0.65 && confidence.externalContext >= 0.25) return 1;
  if (confidence.songIdentification >= 0.55 && confidence.lyrics >= 0.55) return 2;
  if (confidence.songIdentification >= 0.45) return 3;
  return 4;
}
