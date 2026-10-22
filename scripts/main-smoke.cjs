// Exercises native IPC + analyzer Worker against the packaged application.
const {app,BrowserWindow,dialog,shell}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const fixture=path.resolve(__dirname,'../examples/orbital-engine');
const temp=path.join(os.tmpdir(),'repo-map-native-'+process.pid);
app.setPath('userData',temp);
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture]});
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(temp,'export.json')});
let creatorUrl=null;shell.openExternal=async url=>{creatorUrl=url;};
app.once('browser-window-created',(_,win)=>{
  win.webContents.once('did-finish-load',async()=>{
    try{
      const graph=await win.webContents.executeJavaScript('window.repoMap.openFolder()');
      assert.equal(graph.stats.files,27);assert.equal(graph.stats.classes,19);assert.equal(graph.name,'orbital-engine');
      const rescanned=await win.webContents.executeJavaScript('window.repoMap.rescan()');assert.equal(rescanned.nodes.length,graph.nodes.length);
      const history=await win.webContents.executeJavaScript('window.repoMap.recent()');assert.equal(history[0].root,fixture);
      await win.webContents.executeJavaScript('window.repoMap.export()');
      const exported=JSON.parse(await fs.readFile(path.join(temp,'export.json'),'utf8'));
      assert(!exported.root);assert(exported.nodes.every(n=>!('preview'in n)));
      await win.webContents.executeJavaScript('window.repoMap.openCreatorGithub()');
      assert.equal(creatorUrl,'https://github.com/whydoyouseegit');
      console.log(JSON.stringify({nativeIPC:'ok',worker:'ok',files:graph.stats.files,export:'no source code',packaged:process.argv.includes('--packaged')}));
      await fs.rm(temp,{recursive:true,force:true});app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
  });
});
require(process.argv.includes('--packaged')?'../release/win-unpacked/resources/app.asar/electron/main.cjs':'../electron/main.cjs');
setTimeout(()=>{console.error('Native smoke test timed out');app.exit(1);},30000);
