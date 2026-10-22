import { Scene } from '../scene/Scene';
import { Serializer } from './Serializer';
export class ProjectLoader {
  serializer = new Serializer();
  async load(file: File) { return this.serializer.parse(await file.text()); }
  createEmpty() { return new Scene(); }
}
