const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('repoMap',{
  openFolder:()=>ipcRenderer.invoke('project:open'),
  clone:url=>ipcRenderer.invoke('project:clone',url),
  rescan:()=>ipcRenderer.invoke('project:rescan'),
  cancel:()=>ipcRenderer.invoke('project:cancel'),
  recent:()=>ipcRenderer.invoke('project:recent'),
  openCreatorGithub:()=>ipcRenderer.invoke('app:open-creator'),
  reopen:root=>ipcRenderer.invoke('project:reopen',root),
  export:()=>ipcRenderer.invoke('project:export'),
  reveal:id=>ipcRenderer.invoke('file:reveal',id),
  onProgress:callback=>{const listener=(_,data)=>callback(data);ipcRenderer.on('scan:progress',listener);return()=>ipcRenderer.removeListener('scan:progress',listener);}
});
