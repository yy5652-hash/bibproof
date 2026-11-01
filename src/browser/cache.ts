import type { Cache } from '../core/types';
import { MemoryCache } from '../core/http';
export class BrowserCache implements Cache {
  private fallback=new MemoryCache();
  private db:Promise<IDBDatabase>;
  constructor(){this.db=new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(new Error('Storage unavailable'));return;}const r=indexedDB.open('bibproof',1);r.onupgradeneeded=()=>r.result.createObjectStore('responses');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Storage blocked'));});void this.db.catch(()=>{});}
  private async op<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await this.db;return new Promise((resolve,reject)=>{const tx=db.transaction('responses',mode);const r=run(tx.objectStore('responses'));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async get(key:string){try{return await this.op('readonly',s=>s.get(key));}catch{return this.fallback.get(key);}}
  async set(key:string,value:unknown){try{await this.op('readwrite',s=>s.put(value,key));}catch{await this.fallback.set(key,value);}}
  async clear(){try{await this.op('readwrite',s=>s.clear());}finally{await this.fallback.clear();}}
}
