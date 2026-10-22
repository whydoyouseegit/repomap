const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {analyze,parseSource,resolveImport}=require('../electron/analyzer.cjs');
const {validateGitUrl,cloneRepository}=require('../electron/git.cjs');

test('AST extracts nested ownership and static imports without matching comments',()=>{
  const parsed=parseSource('main.ts',`// class Fake {}\nconst text = "class AlsoFake {}";\nimport { Base } from './base.js';\nexport class Worker extends Base { run() { return 1; } handler = () => 2; }\nexport const start = () => new Worker();\nexport { Other } from './other';\nconst lazy = import('./lazy');`);
  assert.equal(parsed.parser,'TypeScript AST');
  assert.deepEqual(parsed.symbols.map(n=>n.name),['Worker','run','handler','start']);
  assert.equal(parsed.symbols.find(n=>n.name==='run').parentSymbol,'Worker:4');
  assert.deepEqual(parsed.imports,['./base.js','./other','./lazy']);
  assert.deepEqual(parsed.inheritance,[{from:'Worker:4',to:'Base'}]);
});

test('relative ESM extensions resolve to TS source and directories to index',()=>{
  const files=new Set(['src/base.ts','src/util/index.ts']);
  assert.equal(resolveImport('src/main.ts','./base.js',files),'src/base.ts');
  assert.equal(resolveImport('src/main.ts','./util',files),'src/util/index.ts');
  assert.equal(resolveImport('src/main.ts','missing',files),null);
});

test('real project scan handles imports, aliases, binary files, ignored folders and symlinks',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repo-map-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const dir of ['src','node_modules','dist'])await fs.mkdir(path.join(root,dir));
  const files={
    'src/main.ts':`import {Base} from '@/base';\nimport {ext} from 'external';\nexport class Child extends Base { run() { return 1; } }`,
    'src/base.ts':'export class Base {}',
    'src/types.ts':'export interface Options { name: string; }',
    'tsconfig.json':JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}}),
    'node_modules/secret.ts':'class Hidden {}','dist/built.js':'class Built {}',
    '.env':'SECRET=abc','private.key':'private key',
    'README.md':'class NotAClass {}',
  };
  for(const [file,text]of Object.entries(files))await fs.writeFile(path.join(root,file),text);
  await fs.writeFile(path.join(root,'image.png'),Buffer.from([137,80,0,78,71]));
  try{await fs.symlink(os.tmpdir(),path.join(root,'outside'));}catch{}
  const graph=await analyze(root);
  assert.equal(graph.stats.files,6);
  assert.equal(graph.stats.classes,3); // Base, Child, Options
  assert.equal(graph.stats.functions,1);
  assert(graph.edges.some(e=>e.source==='src/main.ts'&&e.target==='src/base.ts'&&e.type==='imports'));
  assert(graph.nodes.find(n=>n.id==='src/main.ts').externalImports.includes('external'));
  assert(!graph.nodes.some(n=>/Hidden|Built|NotAClass|secret|private.key|\.env/.test(n.id)));
  assert.equal(graph.nodes.find(n=>n.id==='image.png').preview,'');
  const ids=new Set(graph.nodes.map(n=>n.id));
  assert.equal(ids.size,graph.nodes.length);
  assert(graph.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));
  assert(graph.nodes.every(n=>!n.parent||ids.has(n.parent)));
});

test('empty folders return an informative graph rather than an exception',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repo-map-empty-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const g=await analyze(root);assert.equal(g.nodes.length,0);assert(g.warnings.length);
});

test('non JS languages explicitly label structural parsing',()=>{
  const p=parseSource('worker.py','class Worker:\n    def run(self):\n        return 1\n');
  assert.deepEqual(p.symbols.map(s=>s.name),['Worker','run']);assert(p.parser.includes('приблизительно'));
  const c=parseSource('main.cpp','class Worker {\npublic:\n    int run() { return 1; }\n};\nint main() { return 0; }');
  assert(c.symbols.some(s=>s.name==='Worker'));assert(c.symbols.some(s=>s.name==='main'));
});

test('Git URL validation accepts HTTPS/SSH and rejects command/protocol injection',()=>{
  for(const url of ['https://github.com/example/repo.git','git@github.com:example/repo.git','ssh://git@gitlab.com/team/repo.git'])assert.equal(validateGitUrl(url),url);
  for(const url of ['--upload-pack=evil','file:///tmp/repo','ext::sh -c evil','https://token@github.com/user/repo','https://a:b@github.com/user/repo','https://github.com/user/repo\n--config','https://github.com/'])assert.throws(()=>validateGitUrl(url));
});

test('clone rejects invalid input before starting git',async()=>{
  await assert.rejects(async()=>cloneRepository('file:///tmp/example','/tmp/not-created'),/Поддерживаются/);
});
