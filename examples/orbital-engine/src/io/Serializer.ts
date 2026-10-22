export class Serializer {
  parse(value: string) { return JSON.parse(value); }
  stringify(value: unknown) { return JSON.stringify(value, null, 2); }
}
