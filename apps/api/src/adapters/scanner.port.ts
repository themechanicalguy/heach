/** Virus scanning of an upload before anyone can open it (EN-07, decision D-SCAN). */
export interface VirusScanner {
  scan(content: Buffer): Promise<'clean' | 'infected'>;
}
export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');
