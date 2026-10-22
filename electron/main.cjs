const {app,BrowserWindow,ipcMain,dialog,shell,Menu} = require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {Worker}=require('node:worker_threads');
const {randomUUID}=require('node:crypto');
const {fileURLToPath}=require('node:url');
const {cloneRepository}=require('./git.cjs');
let win, current=null, activeWorker=null, aborter=null, busy=false, recents=[];
const rootHtml=path.join(__dirname,'../src/index.html');
function assertSender(event) { if(event.sender!==win?.webContents || event.senderFrame!==event.sender.mainFrame || fileURLToPath(event.senderFrame.url)!==rootHtml)throw new Error('Недопустимый источник запроса.'); }
const send = progress => {if(win&&!win.isDestroyed())win.webContents.send('scan:progress',progress);};
async function remember(root,name){recents=[{root,name},...recents.filter(x=>x.root!==root)].slice(0,8);await fs.writeFile(path.join(app.getPath('userData'),'recent.json'),JSON.stringify(recents));}
async function scan(root,displayName){
  if(busy) throw new Error('Дождитесь анализа или отмените его.'); busy=true;
  try {
    const graph=await new Promise((resolve,reject)=>{
      const worker=new Worker(path.join(__dirname,'scan-worker.cjs'),{workerData:{root}});activeWorker=worker;
      let settled=false;
      worker.on('message',msg=>{if(msg.progress)send(msg.progress);if(msg.graph){settled=true;resolve(msg.graph);}if(msg.error){settled=true;reject(new Error(msg.error));}});
      worker.on('error',e=>{settled=true;reject(e);});worker.on('exit',()=>{if(!settled)reject(new Error('Анализ отменён.'));});
    });
    graph.name=displayName||recents.find(x=>x.root===root)?.name||graph.name;
    current=graph;await remember(root,graph.name);return graph;
  }finally{busy=false;activeWorker=null;}
}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{assertSender(event);return fn(...args);});}
app.whenReady().then(async()=>{
  await fs.mkdir(app.getPath('userData'),{recursive:true});
  try{const data=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'recent.json'),'utf8'));recents=Array.isArray(data)?data.filter(x=>x&&typeof x.root==='string'&&typeof x.name==='string').slice(0,8):[];}catch{}
  Menu.setApplicationMenu(null);
  if(process.platform==='win32')app.setAppUserModelId('dev.whydoyousee.repomap');
  const iconDirectory=app.isPackaged?process.resourcesPath:path.join(__dirname,'../src/assets');
  const windowIcon=path.join(iconDirectory,process.platform==='win32'?'icon.ico':'icon.png');
  win=new BrowserWindow({width:1500,height:960,minWidth:1000,minHeight:680,backgroundColor:'#0a0a0a',title:'Repo Map',icon:windowIcon,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_,__,callback)=>callback(false));
  handle('project:open',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory'],title:'Открыть папку проекта'});return r.canceled?null:scan(r.filePaths[0]);});
  handle('project:recent',()=>recents);
  handle('app:open-creator',()=>shell.openExternal('https://github.com/whydoyouseegit'));
  handle('project:reopen',async root=>{if(!recents.some(x=>x.root===root))throw new Error('Проекта нет в истории.');return scan(root);});
  handle('project:rescan',async()=>{if(!current)throw new Error('Сначала откройте проект.');return scan(current.root);});
  handle('project:cancel',async()=>{aborter?.abort();await activeWorker?.terminate();return true;});
  handle('project:clone',async url=>{
    if(busy)throw new Error('Дождитесь текущей операции.');
    busy=true;const cache=path.join(app.getPath('userData'),'repositories');await fs.mkdir(cache,{recursive:true});const dest=path.join(cache,randomUUID());
    aborter=new AbortController();
    try{await cloneRepository(url,dest,send,aborter.signal);}catch(e){await fs.rm(dest,{recursive:true,force:true}).catch(()=>{});throw e;}finally{busy=false;aborter=null;}
    return scan(dest,url.replace(/\/$/,'').split(/[/:]/).pop().replace(/\.git$/,''));
  });
  handle('project:export',async()=>{if(!current)throw new Error('Сначала откройте проект.');const result=await dialog.showSaveDialog(win,{defaultPath:`${current.name}.repo-map.json`,filters:[{name:'Repo Map',extensions:['json']}]});if(result.canceled)return false;const graph={...current,root:undefined,nodes:current.nodes.map(({preview,...node})=>node)};await fs.writeFile(result.filePath,JSON.stringify(graph,null,2));return true;});
  handle('file:reveal',async id=>{if(!current?.nodes.some(n=>n.id===id))throw new Error('Файл не найден.');const node=current.nodes.find(n=>n.id===id);const candidate=path.resolve(current.root,node.path);if(path.relative(current.root,candidate).startsWith('..'))throw new Error('Недопустимый путь.');shell.showItemInFolder(candidate);return true;});
  win.loadFile(rootHtml);
});
app.on('window-all-closed',()=>{aborter?.abort();activeWorker?.terminate();app.quit();});
