// Adapter for older renderer tests; production views import state, i18n and html directly.
import {store}from'../../dfplan/src/application/store.mjs';
import {createTask}from'../../dfplan/src/domain/task-schema.mjs';
import {render as renderDirectory}from'../../dfplan/src/ui/views/people.mjs';
import {render as renderDash}from'../../dfplan/src/ui/views/dashboard.mjs';
import {render as renderEditor}from'../../dfplan/src/ui/dialogs/editor.mjs';
import {render as renderCapture}from'../../dfplan/src/ui/views/digitization.mjs';
const language=labels=>labels?.lang||(labels?.s?.('zh','en')==='en'?'en':'zh');
export function renderPeople(project,people,options={},labels={}){store.update({mode:'formal',project:{startDate:'',history:[],...project},people,ready:true,peopleReady:!!options.ready,peopleError:options.error||'',language:language(labels),session:{phase:'ready',user:{email:'fixture@example.com'},admin:{role:'admin',displayName:'Fixture',canManagePeople:!!options.canManage}}});return String(renderDirectory());}
export function renderDashboard(project,people,selection={},labels={}){store.update({project,people,language:language(labels),filter:{query:'',status:'all',person:'all',priority:'all',...selection}});return String(renderDash());}
export function stewardshipEditor(task,labels){store.update({project:{startDate:'',tasks:[{...createTask(task.id),...task}],history:[]},language:language(labels),dialog:{kind:'editor',taskId:task.id}});return String(renderEditor());}
export function assigneeSelect(task,people,labels){store.update({project:{startDate:'',tasks:[{...createTask('fixture'),...task}],history:[]},people,language:language(labels),dialog:{kind:'editor',taskId:'fixture'}});return String(renderEditor());}
export function renderUnitPricing(labels,state){store.update({mode:state.demo?'demo':'formal',language:language(labels),session:{phase:'ready',user:{email:state.canEdit?'fixture@example.com':'',isGuest:!state.canEdit},admin:{role:state.canEdit?'admin':'editor',displayName:'Fixture'}},pricing:{ready:!!state.ready,loading:false,record:null,draft:null,error:state.error||''}});return String(renderCapture());}
