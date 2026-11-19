/// <reference lib="es2022" />
/// <reference lib="dom.iterable" />
/** @typedef {'zh'|'en'} Language */
/** @typedef {{id:string,title:string,titleEn?:string,priority:string,owner:string,ownerEn?:string,assignee?:string,assigneeId?:string,collaborators:string,collaboratorsEn?:string,action:string,actionEn?:string,deliverable:string,deliverableEn?:string,dependency:string,dependencyEn?:string,weekStart:number,weekEnd:number,status:string,due:string,completed:string,next:string,evidence:string,accepted:boolean,updatedAt:string} & Record<string,any>} Task */
/** @typedef {{id:string,at:string,actor:string,text:string,textEn?:string}} HistoryEntry */
/** @typedef {{startDate:string,tasks:Task[],history:HistoryEntry[]}} Project */
/** @typedef {{id:string,displayName:string,responsibility:string,active:boolean}} Person */
/** @typedef {{phase:string,invite?:boolean,user?:{uid?:string,email?:string,isGuest?:boolean},admin?:{role:string,displayName:string,email?:string,canManagePeople?:boolean}}} Session */
/** @typedef {{page:number,photo:number,audioMinute:number,videoMinute:number,setup:number,minimum:number}} UnitRates */
/** @typedef {{kind:string,taskId?:string,assertionId?:string,data?:any}} DialogDescriptor */
/** @typedef {{id:string,text:string,status:'unverified'|'confirmed'|'conflict',note:string,source:string,updatedAt:string}} Assertion */
/** @typedef {{mode:'demo'|'formal'|'local',project:Project,people:Person[],session:Session,ready:boolean,language:Language,elder:boolean,view:string,scrollTop:Record<string,number>,filter:{query:string,status:string,person:string,priority:string,focus?:string},dialog:DialogDescriptor|null,message:string,error:string,busy:boolean,revision:number,peopleReady:boolean,peopleError:string,pricing:{ready:boolean,loading:boolean,record:any,error:string,draft:any},capture:Record<string,number>,team:number,captureCategory:number,demoPatrick:boolean,accountData:any}} AppState */
/** @typedef {{load:()=>Promise<Project>,save:(next:Project,text:string,textEn:string)=>Promise<any>,loadPeople:()=>Promise<Person[]>,addPerson:(name:string,responsibility:string)=>Promise<any>,setPersonActive:(id:string,active:boolean)=>Promise<any>,readPreference:(key:string,fallback:string)=>string,writePreference:(key:string,value:string)=>void}} StoragePort */
export {};
