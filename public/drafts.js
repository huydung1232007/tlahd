/* Device-only drafts. Large media belongs in IndexedDB, never localStorage. */
(function(global){
  'use strict';
  let opening,queue=Promise.resolve();
  function db(){
    if(!opening)opening=new Promise((resolve,reject)=>{
      if(!global.indexedDB){reject(Error('Trình duyệt chưa hỗ trợ lưu nháp.'));return;}
      const request=indexedDB.open('cham-local-drafts',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('Không mở được bộ nhớ nháp.'));
      request.onblocked=()=>reject(Error('Đóng tab Chạm cũ rồi thử lại để lưu nháp.'));
    });return opening;
  }
  async function transaction(mode,action){const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('drafts',mode),request=action(tx.objectStore('drafts'));let value;
    request.onsuccess=()=>{value=request.result;};
    tx.oncomplete=()=>resolve(value??null);
    tx.onerror=tx.onabort=()=>reject(Error('Không lưu được nháp. Bộ nhớ trình duyệt có thể đã đầy.'));
  });}
  function enqueue(task){const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
  const get=key=>enqueue(()=>transaction('readonly',store=>store.get(key)));
  const put=(key,value)=>enqueue(()=>transaction('readwrite',store=>store.put({...value,savedAt:Date.now()},key)));
  const remove=key=>enqueue(()=>transaction('readwrite',store=>store.delete(key)));
  function readPreference(key,fallback=[]){try{return JSON.parse(localStorage.getItem('cham:'+key))??fallback;}catch{return fallback;}}
  function writePreference(key,value){try{localStorage.setItem('cham:'+key,JSON.stringify(value));return true;}catch{return false;}}
  global.ChamDrafts={get,put,remove,readPreference,writePreference};
})(typeof window!=='undefined'?window:globalThis);
