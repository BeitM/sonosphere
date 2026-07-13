import type { LyricsLookup, MusicalAnalysis, SongContext, SongIdentification } from "@/lib/schemas";

export type AudioInput = { name: string; type: string; size: number; bytes?: ArrayBuffer };
export type SongRecognitionInput = { audio: AudioInput; manualTitle?: string; manualArtist?: string; fixtureId?: string };
export type LyricsLookupInput = { title?: string; artist?: string; manualLyrics?: string; fixtureId?: string };
export type ContextResearchInput = { title?: string; artist?: string; manualContext?: string; fixtureId?: string };
export type MusicAnalysisInput = { audio?: AudioInput; fixtureId?: string };

export interface SongRecognitionProvider { readonly name: string; identifySong(input: SongRecognitionInput): Promise<SongIdentification>; }
export interface LyricsProvider { readonly name: string; findLyrics(input: LyricsLookupInput): Promise<LyricsLookup>; }
export interface SongContextProvider { readonly name: string; research(input: ContextResearchInput): Promise<SongContext>; }
export interface MusicAnalysisProvider { readonly name: string; analyze(input: MusicAnalysisInput): Promise<MusicalAnalysis>; }
export interface LyricsTranscriptionProvider { readonly name: string; transcribe(input: MusicAnalysisInput): Promise<LyricsLookup>; }
