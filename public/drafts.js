/* Session-only drafts: kept in memory while navigating tabs, cleared automatically on app exit or after posting. */
(function(global){
  'use strict';
  const memory=new Map();
  try{global.indexedDB?.deleteDatabase?.('cham-local-drafts');}catch{}
  const get=async key=>memory.has(key)?structuredClone(memory.get(key)):null;
  const put=async(key,value)=>{memory.set(key,structuredClone({...value,savedAt:Date.now()}));return null;};
  const remove=async key=>{memory.delete(key);return null;};
  const clearAll=async()=>{memory.clear();return null;};
  function readPreference(key,fallback=[]){try{return JSON.parse(localStorage.getItem('cham:'+key))??fallback;}catch{return fallback;}}
  function writePreference(key,value){try{localStorage.setItem('cham:'+key,JSON.stringify(value));return true;}catch{return false;}}
  global.ChamDrafts={get,put,remove,clearAll,readPreference,writePreference};
})(typeof window!=='undefined'?window:globalThis);
