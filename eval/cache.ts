import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Cache } from '../src/core/types';
export class DiskCache implements Cache{
  constructor(private dir='eval/cache'){}
  private path(key:string){return `${this.dir}/${createHash('sha256').update(key).digest('hex')}.json`;}
  async get(key:string){try{return JSON.parse(await readFile(this.path(key),'utf8'));}catch{return undefined;}}
  async set(key:string,value:unknown){await mkdir(this.dir,{recursive:true});const path=this.path(key);await writeFile(path+'.tmp',JSON.stringify(value));await rename(path+'.tmp',path);}
}
