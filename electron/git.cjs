const { spawn } = require('node:child_process');
function validateGitUrl(value) {
  if(typeof value!=='string'||value.length>2048||/[\s\x00-\x1f]/.test(value)) throw new Error('Укажите HTTPS- или SSH-ссылку Git-репозитория.');
  if(/^git@[a-zA-Z0-9.-]+:[\w./~-]+$/.test(value) && !value.includes('..')) return value;
  let u; try { u = new URL(value); } catch { throw new Error('Некорректная Git-ссылка.'); }
  if(!['https:','ssh:'].includes(u.protocol)||!u.hostname||u.password||u.search||u.hash||u.pathname==='/'|| (u.username&&u.protocol==='https:')) throw new Error('Поддерживаются HTTPS без токенов в ссылке и SSH.');
  return value;
}
function cloneRepository(url, dest, onProgress = ()=>{}, signal) {
  validateGitUrl(url);
  return new Promise((resolve,reject)=>{
    const child=spawn('git',['-c','protocol.file.allow=never','-c','protocol.ext.allow=never','clone','--depth','1','--no-recurse-submodules','--progress','--',url,dest],{shell:false,windowsHide:true,signal,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_SSH_COMMAND:'ssh -oBatchMode=yes -oStrictHostKeyChecking=yes'}});
    let tail='';
    const timeout=setTimeout(()=>{child.kill();},180000);
    child.stderr.on('data',buf=>{tail=(tail+buf.toString()).slice(-6000);onProgress({phase:'clone',message:buf.toString().slice(-300)});});
    child.on('error',e=>{clearTimeout(timeout);reject(new Error(e.code==='ENOENT'?'Git не найден. Установите Git и перезапустите программу.':e.name==='AbortError'?'Клонирование отменено.':e.message));});
    child.on('close',code=>{clearTimeout(timeout);code===0?resolve(dest):reject(new Error(`Не удалось клонировать репозиторий. Проверьте ссылку и доступ.\n${tail.slice(-1200)}`));});
  });
}
module.exports={validateGitUrl,cloneRepository};
