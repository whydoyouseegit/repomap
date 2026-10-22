const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ResEdit=require('resedit');
const manifest=require('../package.json');

function verifyWindows(appOutDir){
  const executable=path.join(appOutDir,'Repo Map.exe');
  const expectedIcon=path.resolve(__dirname,'../src/assets/icon.ico');
  const exe=ResEdit.NtExecutable.from(fs.readFileSync(executable),{ignoreCert:true});
  const resources=ResEdit.NtExecutableResource.from(exe);
  const expected=ResEdit.Data.IconFile.from(fs.readFileSync(expectedIcon));
  const groups=ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  assert(groups.length,'The executable has no icon resource');
  const bytes=item=>Buffer.from(item.isRaw()?item.bin:item.generate());
  assert(groups.some(group=>{
    const actual=group.getIconItemsFromEntries(resources.entries);
    return actual.length===expected.icons.length&&actual.every((item,i)=>bytes(item).equals(bytes(expected.icons[i].data)));
  }),'The executable icon does not match the Repo Map icon; refusing to package the default Electron icon');
  const versions=ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  assert(versions.some(version=>version.getAllLanguagesForStringValues().some(lang=>{
    const values=version.getStringValues(lang);
    return values.ProductName===manifest.build.productName&&values.CompanyName===manifest.author&&values.FileVersion?.startsWith(manifest.version);
  })),'Windows executable product, author or version metadata is incorrect');
  for(const name of ['icon.ico','icon.png'])assert(fs.readFileSync(path.join(appOutDir,'resources',name)).equals(fs.readFileSync(path.resolve(__dirname,'../src/assets',name))),`Missing or incorrect runtime icon: ${name}`);
  console.log(`Verified Repo Map ${manifest.version}: embedded icon, publisher metadata and runtime icons`);
}

module.exports=async context=>{if(context.electronPlatformName==='win32')verifyWindows(context.appOutDir);};
module.exports.verifyWindows=verifyWindows;
if(require.main===module){try{verifyWindows(path.resolve(process.argv[2]||'release/win-unpacked'));}catch(error){console.error(error.message);process.exitCode=1;}}
