(() => {
  const $=id=>document.getElementById(id),api=window.repoMap;
  const state={graph:null,demo:true,selected:null,tab:'relations',expanded:new Set(),search:'',busy:false};
  const kindName={file:'ФАЙЛ',directory:'ПАПКА',class:'КЛАСС',interface:'ИНТЕРФЕЙС',function:'ФУНКЦИЯ / МЕТОД'};
  const icons={file:'◦',directory:'▱',class:'◇',interface:'◇',function:'ƒ'};
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  let toastTimer;
  function toast(message,duration=5500){$('toast').textContent=String(message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,duration);}
  const universe=new Universe($('space'),id=>select(id),(node,x,y)=>{const label=$('hoverLabel');label.hidden=!node;if(node){label.textContent=`${icons[node.kind]} ${node.name}${node.line?':'+node.line:''}`;label.style.left=Math.min(x+14,$('universe').clientWidth-200)+'px';label.style.top=(y+15)+'px';}});
  universe.updateZoom=()=>{$('zoomValue').textContent=Math.round(universe.zoom*100)+'%';updatePause();};
  function updatePause(){$('pause').textContent=universe.play?'Ⅱ':'▷';$('pause').title=universe.play?'Приостановить вращение':'Включить вращение';$('pause').setAttribute('aria-label',$('pause').title);}
  function setGraph(graph,demo=false){
    state.graph=graph;state.demo=demo;state.selected=null;state.search='';$('search').value='';universe.query='';state.expanded=new Set(graph.nodes.filter(n=>n.kind==='directory'&&n.path.split('/').length<=1).map(n=>n.id));
    $('projectName').textContent=graph.name;$('projectName').title=graph.root||'Демонстрационный проект';$('treeRoot').textContent=graph.name;$('demoBadge').hidden=!demo;
    $('treeCount').textContent=graph.stats.files;
    $('statFiles').textContent=graph.stats.files;$('statClasses').textContent=graph.stats.classes;$('statFunctions').textContent=graph.stats.functions;$('statEdges').textContent=graph.edges.filter(e=>e.type==='imports').length;
    $('status').textContent=demo?'Демонстрационный проект':graph.warnings.length?graph.warnings[0]:'Проект проиндексирован';
    $('rescan').disabled=demo;$('exportBtn').disabled=demo;$('subtitle').textContent=demo?'Исследуйте демо или откройте свой проект.':'Файлы. Классы. Связи между ними.';
    universe.setGraph(graph);universe.updateZoom();renderTree();renderInspector();refreshRecents();
    if(graph.warnings.length)toast(graph.warnings.join('\n'),9000);
  }
  const childMap=()=>{const map=new Map();for(const n of state.graph.nodes){const key=n.parent||null;if(!map.has(key))map.set(key,[]);map.get(key).push(n);}for(const list of map.values())list.sort((a,b)=>(a.kind==='directory'?-1:0)-(b.kind==='directory'?-1:0)||a.name.localeCompare(b.name));return map;};
  function renderTree(){
    const tree=$('tree');tree.replaceChildren();const query=state.search.toLowerCase(),children=childMap();let count=0;
    function row(n,depth){
      if(count++>=750)return;
      const hasChildren=children.has(n.id),expanded=state.expanded.has(n.id);
      const button=el('button','tree-row'+(n.id===state.selected?' selected':''));button.style.paddingLeft=(8+depth*12)+'px';button.title=n.path+(n.line?':'+n.line:'');button.setAttribute('role','treeitem');button.setAttribute('aria-selected',n.id===state.selected);if(hasChildren)button.setAttribute('aria-expanded',expanded);
      button.append(el('span','node-icon',hasChildren?(expanded?'⌄':'›'):icons[n.kind]),el('span','node-name',n.name));
      if(n.kind==='file'){const ext=n.name.includes('.')?n.name.split('.').pop():'';button.append(el('span','node-ext',ext.toUpperCase()));}
      if(n.kind==='class')button.append(el('span','node-ext','CLASS'));
      button.onclick=()=>{if(hasChildren){expanded?state.expanded.delete(n.id):state.expanded.add(n.id);}select(n.id,true);};tree.append(button);
      if(!query&&expanded)for(const child of children.get(n.id)||[])row(child,depth+1);
    }
    if(query){for(const n of state.graph.nodes.filter(n=>(n.name+' '+n.path).toLowerCase().includes(query)).slice(0,150))row(n,0);}else for(const n of children.get(null)||[])row(n,0);
    if(!tree.childElementCount)tree.append(el('div','tree-empty',query?'Совпадений нет.':'В проекте пока нет файлов.'));
    if(count>=750)tree.append(el('div','tree-empty','Показаны первые 750 узлов. Используйте поиск.'));
  }
  function select(id,focus=false){
    state.selected=id;state.tab='relations';universe.select(id);if(focus){universe.focus(id);updatePause();}
    renderTree();renderInspector();
  }
  function relatedButton(node,prefix){const b=el('button','related');b.append(el('span','muted',prefix||icons[node.kind]),el('span','name',node.name));b.title=node.path;b.onclick=()=>select(node.id,true);return b;}
  function renderInspector(){
    const box=$('inspectorContent');box.replaceChildren();const graph=state.graph,node=graph.nodes.find(n=>n.id===state.selected);
    if(!node){
      const empty=el('div','empty-node'),art=el('div','node-art');
      art.innerHTML='<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="30" stroke="#333" stroke-dasharray="2 5"/><ellipse cx="50" cy="50" rx="43" ry="14" stroke="#4a4a4a" transform="rotate(-35 50 50)"/><ellipse cx="50" cy="50" rx="43" ry="14" stroke="#252525" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="3" fill="#ddd"/><circle cx="80" cy="28" r="2" fill="#aaa"/><circle cx="23" cy="71" r="1.5" fill="#777"/></svg>';
      empty.append(art,el('div','eyebrow','НИ ОДИН УЗЕЛ НЕ ВЫБРАН'),el('h2','', 'У каждого файла\nсвоя орбита.'),el('p','','Выберите точку на карте или элемент в дереве. Здесь появятся код, символы и зависимости.'),el('div','command-line','$ select <node>'));box.append(empty);return;
    }
    box.append(el('div','node-kind',kindName[node.kind]),el('h2','node-title',node.name),el('div','node-path',node.path+(node.line?`:${node.line}`:'')));
    const outgoing=graph.edges.filter(e=>e.source===node.id&&e.type!=='contains'),incoming=graph.edges.filter(e=>e.target===node.id&&e.type!=='contains'),children=graph.edges.filter(e=>e.source===node.id&&e.type==='contains');
    const stats=el('div','node-stats');for(const [value,label] of [[node.lines??children.length,node.kind==='directory'?'элементов':'строк кода'],[outgoing.length+incoming.length,'связей']]){const stat=el('div');stat.append(el('b','',String(value)),el('span','',label));stats.append(stat);}box.append(stats);
    const tabs=el('div','inspector-tabs');for(const [key,text]of[['relations','Состав и связи'],['code','Код']]){const button=el('button',state.tab===key?'active':'',text);button.onclick=()=>{state.tab=key;renderInspector();};tabs.append(button);}box.append(tabs);
    const map=new Map(graph.nodes.map(n=>[n.id,n]));
    if(state.tab==='relations'){
      if(node.parent&&map.has(node.parent)){box.append(el('div','relation-title','РАСПОЛОЖЕНИЕ'),relatedButton(map.get(node.parent),'↑'));}
      if(children.length){box.append(el('div','relation-title',`СОСТАВ / ${children.length}`));for(const edge of children.slice(0,100))box.append(relatedButton(map.get(edge.target)));}
      if(outgoing.length){box.append(el('div','relation-title','ИСПОЛЬЗУЕТ →'));for(const edge of outgoing.slice(0,100))box.append(relatedButton(map.get(edge.target),edge.type==='inherits'?'◇':'↗'));}
      if(incoming.length){box.append(el('div','relation-title','ИСПОЛЬЗУЕТСЯ В ←'));for(const edge of incoming.slice(0,100))box.append(relatedButton(map.get(edge.source),'↙'));}
      if(node.externalImports?.length){box.append(el('div','relation-title','ВНЕШНИЕ / НЕРАЗРЕШЁННЫЕ ИМПОРТЫ'));for(const spec of node.externalImports.slice(0,30))box.append(el('div','parser-note',spec));}
      if(!children.length&&!outgoing.length&&!incoming.length)box.append(el('p','parser-note','Для этого узла связи не обнаружены.'));
    }else{
      const file=node.kind==='file'?node:graph.nodes.find(n=>n.id===node.path),content=file?.preview||'';
      if(content){const start=node.line?Math.max(0,node.line-1):0;const lines=content.split('\n').slice(start,node.endLine?Math.min(node.endLine,start+120):120);const pre=el('pre','code-preview');lines.forEach((line,i)=>{pre.append(el('span','',String(start+i+1).padStart(3)+'  '),document.createTextNode(line+'\n'));});box.append(pre);if(file.truncated||lines.length>=120)box.append(el('p','parser-note','Показан фрагмент. Полный файл доступен через проводник.'));}
      else box.append(el('p','parser-note',node.kind==='directory'?'Выберите файл внутри папки.':'Нет текстового предпросмотра. Бинарный или слишком большой файл.'));
    }
    if(!state.demo){const reveal=el('button','button reveal','↗ Показать в проводнике');reveal.onclick=()=>api.reveal(node.id).catch(e=>toast(e.message));box.append(reveal);}
    box.append(el('p','parser-note',node.parser||'Структура папок'));
  }
  async function refreshRecents(){if(!api)return;try{const recent=await api.recent();const box=$('recents');box.replaceChildren();for(const item of recent){const b=el('button','',item.name);b.title=item.root;b.onclick=()=>run(()=>api.reopen(item.root));box.append(b);}}catch{}}
  async function run(task){
    if(!api){toast('Запустите Repo Map через приложение Electron.');return;}
    if(state.busy)return;state.busy=true;$('progressText').textContent='Чтение проекта…';$('progress').removeAttribute('value');$('progressDialog').showModal();
    try{const graph=await task();if(graph)setGraph(graph,false);}catch(e){toast(e.message,10000);}finally{state.busy=false;$('progressDialog').close();}
  }
  $('openFolder').onclick=()=>run(()=>api.openFolder());
  $('cloneBtn').onclick=()=>{$('gitDialog').showModal();$('gitUrl').focus();};
  $('gitForm').onsubmit=e=>{e.preventDefault();const url=$('gitUrl').value.trim();if(!url)return;$('gitDialog').close();run(()=>api.clone(url));};
  $('rescan').onclick=()=>run(()=>api.rescan());
  $('cancelScan').onclick=async()=>{try{await api.cancel();}catch(e){toast(e.message);}};
  $('exportBtn').onclick=async()=>{try{if(await api.export())toast('Структура сохранена. Исходный код в JSON не включён.');}catch(e){toast(e.message);}};
  $('openHelp').onclick=()=>$('helpDialog').showModal();
  $('creatorGithub').onclick=async e=>{e.preventDefault();try{await api.openCreatorGithub();}catch(error){toast(error.message);}};
  document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('search').oninput=e=>{state.search=e.target.value;universe.query=state.search.toLowerCase();renderTree();};
  $('search').onkeydown=e=>{if(e.key==='Enter'){const first=state.graph.nodes.find(n=>(n.name+' '+n.path).toLowerCase().includes(state.search.toLowerCase()));if(first)select(first.id,true);}};
  $('clearSelection').onclick=()=>{state.selected=null;universe.select(null);renderInspector();renderTree();};
  $('collapseTree').onclick=()=>{state.expanded.clear();renderTree();};
  $('navFiles').onclick=()=>{$('search').focus();document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active'));$('navFiles').classList.add('active');};
  $('navMap').onclick=()=>{$('space').focus();document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active'));$('navMap').classList.add('active');};
  $('pause').onclick=()=>{universe.play=!universe.play;updatePause();};$('zoomIn').onclick=()=>universe.zoomBy(1.2);$('zoomOut').onclick=()=>universe.zoomBy(1/1.2);$('resetView').onclick=()=>universe.reset();
  document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-layout]').forEach(x=>x.classList.toggle('active',x===b));universe.setLayout(b.dataset.layout);});
  for(const [id,kinds] of [['showFiles',['file','directory']],['showClasses',['class','interface']],['showFunctions',['function']],['showEdges',['edges']],['showDust',['dust']]])$(id).onchange=e=>kinds.forEach(kind=>universe.filters[kind]=e.target.checked);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!document.querySelector('dialog[open]')){$('clearSelection').click();return;}
    if(['INPUT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;
    if(e.key==='/'){e.preventDefault();$('search').focus();}else if(e.code==='Space'){e.preventDefault();$('pause').click();}else if(e.key.toLowerCase()==='r')universe.reset();else if(e.key==='+')universe.zoomBy(1.2);else if(e.key==='-')universe.zoomBy(1/1.2);
  });
  api?.onProgress(progress=>{if(progress.phase==='clone'){$('progressText').textContent=progress.message;$('progress').removeAttribute('value');}else{$('progressText').textContent=`${progress.done} / ${progress.total} · ${progress.file}`;$('progress').value=progress.total?progress.done/progress.total*100:0;}});
  $('progressDialog').addEventListener('cancel',e=>{e.preventDefault();$('cancelScan').click();});
  setGraph(window.DEMO_GRAPH,true);updatePause();
  window.__repoMapTest={state,universe,select,setGraph};
})();
