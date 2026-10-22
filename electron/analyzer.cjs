const fs = require('node:fs/promises');
const path = require('node:path');
const ts = require('typescript');

const IGNORED = new Set(['.git','node_modules','vendor','.next','.nuxt','dist','build','coverage','target','.venv','venv','__pycache__','.idea','.vs','.cache']);
const SOURCE = /\.(?:[cm]?[jt]sx?|py|cpp|cc|cxx|c|h|hpp|java|cs|rs|go)$/i;
const TEXT = /\.(?:[cm]?[jt]sx?|py|cpp|cc|cxx|c|h|hpp|java|cs|rs|go|json|md|txt|css|scss|html|yaml|yml|toml|xml|sh|bat|sql|svg|ini|cfg|gitignore)$/i;
const posix = s => s.split(path.sep).join('/');
const isSensitive = name => /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name);

function parseSource(file, content) {
  const symbols = [], imports = [], inheritance = [];
  if (/\.[cm]?[jt]sx?$/i.test(file)) {
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const add = (node, name, kind, parent) => {
      const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const end = sf.getLineAndCharacterOfPosition(node.end);
      const symbol = { name, kind, line: start.line + 1, endLine: end.line + 1, parentSymbol: parent, key: `${name}:${start.line + 1}` };
      symbols.push(symbol); return symbol;
    };
    const visit = (node, owner = null) => {
      let current = owner;
      if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) {
        current = add(node, node.name.text, 'class', owner?.key);
        for (const clause of node.heritageClauses || []) for (const base of clause.types) inheritance.push({ from: current.key, to: base.expression.getText(sf) });
      } else if (ts.isInterfaceDeclaration(node)) current = add(node, node.name.text, 'interface', owner?.key);
      else if (ts.isFunctionDeclaration(node) && node.name) current = add(node, node.name.text, 'function', owner?.key);
      else if ((ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) && node.name) current = add(node, node.name.getText(sf), 'function', owner?.key);
      else if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) current = add(node, node.name.getText(sf), 'function', owner?.key);
      else if (ts.isPropertyDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)) current = add(node, node.name.getText(sf), 'function', owner?.key);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) imports.push(node.moduleReference.expression.text);
      if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) imports.push(node.arguments[0].text);
      ts.forEachChild(node, child => visit(child, current));
    };
    visit(sf);
    return { symbols, imports: [...new Set(imports)], inheritance, parser: 'TypeScript AST', diagnostics: sf.parseDiagnostics.length };
  }
  if (!SOURCE.test(file)) return { symbols, imports, inheritance, parser: 'Файл', diagnostics: 0 };
  // Other languages have explicitly labelled structural, heuristic extraction.
  const clean = content.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g,'');
  const lines = clean.split('\n');
  const python = /\.py$/i.test(file);
  const cFamily = /\.(?:cpp|cc|cxx|c|h|hpp|java|cs)$/i.test(file);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cls = python ? line.match(/^\s*class\s+(\w+)/) : line.match(/^\s*(?:(?:public|private|protected|abstract|final|export)\s+)*(?:class|struct|interface|enum)\s+(\w+)/);
    const fn = python ? line.match(/^\s*(?:async\s+)?def\s+(\w+)\s*\(/) : cFamily ? line.match(/^\s*(?:(?:[\w:*&<>\[\],]+)\s+)+(\w+)\s*\([^;]*\)\s*(?:const\s*)?(?:\{|$)/) : line.match(/^\s*(?:pub\s+)?(?:async\s+)?(?:fn|func)\s+(\w+)\s*\(/);
    const m = cls || fn;
    if (m && !['if','for','while','switch','return','catch'].includes(m[1])) symbols.push({ name: m[1], kind: cls ? 'class' : 'function', line: i + 1, endLine: i + 1, key: `${m[1]}:${i+1}` });
    const inc = line.match(/^\s*#\s*include\s*"([^"]+)"/); if(inc) imports.push(inc[1]);
  }
  return { symbols, imports, inheritance, parser: SOURCE.test(file) ? 'Структурный разбор (приблизительно)' : 'Файл', diagnostics: 0 };
}

function resolveImport(from, spec, files, options = {}, root = '') {
  if (root && /\.[cm]?[jt]sx?$/i.test(from)) {
    const found = ts.resolveModuleName(spec, path.join(root, from), options, ts.sys).resolvedModule;
    if (found) { const rel = posix(path.relative(root, found.resolvedFileName)); if(files.has(rel)) return rel; }
  }
  const stem = posix(path.normalize(path.join(path.dirname(from), spec)));
  const stems = [stem];
  if (/\.(?:js|jsx|mjs|cjs)$/.test(stem)) stems.push(stem.replace(/\.(?:js|jsx|mjs|cjs)$/, ''));
  for (const base of stems) for (const ext of ['', '.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs','.json','/index.ts','/index.tsx','/index.js','/index.jsx']) if(files.has(base + ext)) return base + ext;
  return null;
}

async function analyze(root, report = () => {}) {
  root = await fs.realpath(root);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Выберите папку проекта.');
  const graph = { version: 1, name: path.basename(root), root, nodes: [], edges: [], warnings: [], stats: { files: 0, directories: 0, classes: 0, functions: 0, lines: 0, skipped: 0, bytes: 0 }, createdAt: new Date().toISOString() };
  const paths = [], limit = 6000;
  async function walk(dir, rel = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a,b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if(paths.length >= limit) return;
      if (entry.isSymbolicLink() || IGNORED.has(entry.name) || isSensitive(entry.name)) { graph.stats.skipped++; continue; }
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { try { await walk(path.join(dir,entry.name), next); } catch { graph.stats.skipped++; } }
      else if (entry.isFile()) paths.push(next);
    }
  }
  await walk(root);
  if(paths.length >= limit) graph.warnings.push(`Лимит ${limit} файлов: показана часть проекта.`);
  const files = new Set(paths), parsed = new Map();
  let options = { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext };
  const configPath = ts.findConfigFile(root, ts.sys.fileExists);
  if(configPath && !path.relative(root, configPath).startsWith('..')) {
    try { const cfg = ts.readConfigFile(configPath, ts.sys.readFile); options = {...options,...ts.convertCompilerOptionsFromJson(cfg.config?.compilerOptions || {}, path.dirname(configPath)).options}; } catch {}
  }
  const dirs = new Set();
  for (let i = 0; i < paths.length; i++) {
    const rel = paths[i], abs = path.join(root, rel);
    let info; try { info = await fs.stat(abs); } catch { graph.stats.skipped++; continue; }
    let content = '', truncated = false;
    if(TEXT.test(rel) || /^(?:LICENSE|Dockerfile|Makefile|\.gitignore)$/i.test(path.basename(rel))) {
      if (info.size <= 768*1024 && graph.stats.bytes < 32*1024*1024) {
        const raw = await fs.readFile(abs); if(!raw.includes(0)) { content = raw.toString('utf8'); graph.stats.bytes += raw.length; }
      } else truncated = true;
    }
    const parent = posix(path.dirname(rel));
    const parts = parent === '.' ? [] : parent.split('/');
    parts.forEach((_,j) => dirs.add(parts.slice(0,j+1).join('/')));
    const p = parseSource(rel, content); parsed.set(rel, p);
    const lines = content ? content.split('\n').length : 0;
    const group = ['src','lib','app'].includes(parts[0]) ? parts.slice(0,2).join('/') : parts[0] || '(root)';
    const fileNode = {id:rel,name:path.basename(rel),kind:'file',path:rel,parent: parent === '.' ? null : `dir:${parent}`,group,lines,size:info.size,parser:p.parser,diagnostics:p.diagnostics,preview:content.slice(0,80000),truncated:truncated || content.length>80000,externalImports:[]};
    graph.nodes.push(fileNode); graph.stats.files++; graph.stats.lines+=lines;
    if (fileNode.parent) graph.edges.push({source:fileNode.parent,target:rel,type:'contains'});
    const symbolIds = new Map(p.symbols.map(s=>[s.key,`${rel}#${s.key}`]));
    for(const s of p.symbols) {
      const id = symbolIds.get(s.key), owner = symbolIds.get(s.parentSymbol) || rel;
      graph.nodes.push({id,name:s.name,kind:s.kind,path:rel,parent:owner,group,line:s.line,endLine:s.endLine,lines:s.endLine-s.line+1,parser:p.parser});
      graph.edges.push({source:owner,target:id,type:'contains'});
      if(s.kind==='function')graph.stats.functions++; else graph.stats.classes++;
    }
    for(const item of p.inheritance) {
      const base = p.symbols.find(s=>s.kind==='class' && s.name===item.to);
      if(base)graph.edges.push({source:symbolIds.get(item.from),target:symbolIds.get(base.key),type:'inherits'});
    }
    if(i%40===0) { report({phase:'analyze',done:i,total:paths.length,file:rel}); await new Promise(resolve=>setImmediate(resolve)); }
  }
  for(const dir of dirs) {
    const parent = posix(path.dirname(dir));
    const parts=dir.split('/');
    const group=['src','lib','app'].includes(parts[0])?parts.slice(0,2).join('/'):parts[0];
    graph.nodes.push({id:`dir:${dir}`,name:path.basename(dir),kind:'directory',path:dir,parent:parent==='.'?null:`dir:${parent}`,group});
    if(parent!=='.')graph.edges.push({source:`dir:${parent}`,target:`dir:${dir}`,type:'contains'});
  }
  for(const node of graph.nodes.filter(n=>n.kind==='file')) for(const spec of parsed.get(node.id)?.imports || []) {
    const target = resolveImport(node.path,spec,files,options,root);
    if(target && target!==node.id) graph.edges.push({source:node.id,target,type:'imports'});
    else node.externalImports.push(spec);
  }
  graph.stats.directories=dirs.size;
  if (!graph.stats.files) graph.warnings.push('В этой папке нет доступных файлов.');
  const valid = new Set(graph.nodes.map(n=>n.id)); graph.edges=graph.edges.filter(e=>valid.has(e.source)&&valid.has(e.target));
  return graph;
}
module.exports = { analyze, parseSource, resolveImport, IGNORED, isSensitive };
