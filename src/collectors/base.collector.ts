import { RawOdd } from '../types';

export abstract class BaseCollector {
  abstract readonly name: string;

  abstract fetchOdds(): Promise<RawOdd[]>;

  protected log(msg: string) {
    console.log(`[${this.name}] ${msg}`);
  }

  protected logError(msg: string, err?: unknown) {
    console.error(`[${this.name}] ERROR: ${msg}`, err);
  }
}
