export type FixtureInfo = {
  name: string;
  path: string;
  description: string;
  type: 'text' | 'binary' | 'json';
};

export const FIXTURES: FixtureInfo[] = [
  {
    name: 'hello-world.txt',
    path: './fixtures/hello-world.txt',
    description: 'Plain text greeting file for basic encode/decode checks.',
    type: 'text'
  },
  {
    name: 'sample.png',
    path: './fixtures/sample.png',
    description: '1×1 red pixel PNG for binary round-trip verification.',
    type: 'binary'
  },
  {
    name: 'data-sample.json',
    path: './fixtures/data-sample.json',
    description: 'Small JSON sample for structured text encoding.',
    type: 'json'
  }
];