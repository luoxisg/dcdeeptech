'use strict';

const get = id => document.getElementById(id);
const breadcrumb = [];
let selected = branches[0].start;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, className, action) {
  const control = node('button', text, className);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}

function choose(id) {
  if (id === selected) return;
  breadcrumb.push(selected);
  selected = id;
  render();
  get('person-name').focus();
}

function renderList() {
  const value = get('query').value;
  const searching = Boolean(value.trim());
  get('list-title').textContent = searching ? '搜索结果' : '支系入口';
  const items = searching ? search(value).map(person => ({
    id: person.id,
    title: person.name,
    detail: `第 ${person.generation} 世 · ${person.branch}${person.alias ? ' · 字' + person.alias : ''}`
  })) : branches.map(branch => ({ id: branch.start, title: branch.name, detail: branch.description }));
  get('results').replaceChildren(...items.map(item => {
    const row = button('', 'result', () => choose(item.id));
    if (searching ? selected === item.id : byId.get(selected).branch === item.title) row.setAttribute('aria-current', 'true');
    row.append(node('strong', item.title), node('span', item.detail));
    return row;
  }));
  if (!items.length) get('results').append(node('p', '未找到人物，可试试其他姓名或字号。', 'muted'));
}

function openSource(page) {
  const record = sourcePage(page);
  get('page-label').textContent = `示例卷 · 第 ${page} 页`;
  const paper = get('facsimile');
  paper.replaceChildren(node('p', '清溪沈氏 · 世系样张', 'eyebrow'), node('h3', '家乘录'));
  for (const person of record.people) {
    paper.append(node('p', `第 ${person.generation} 世　${person.name}${person.alias ? '，字' + person.alias : ''}。`));
  }
  for (const [from, to, role] of record.links) {
    const first = byId.get(from).name;
    const second = byId.get(to).name;
    paper.append(node('p', role === '配偶' ? `${first}与${second}为配偶。` : `${second}之${role}为${first}。`));
  }
  paper.append(node('p', '此页为虚构样张。', 'muted'));
  setZoom(false);
  get('source').showModal();
}

function setZoom(expanded) {
  get('facsimile').classList.toggle('zoomed', expanded);
  get('zoom').setAttribute('aria-pressed', String(expanded));
  get('zoom').textContent = expanded ? '缩小' : '放大';
}

function render() {
  const person = byId.get(selected);
  const name = node('h2', person.name);
  name.id = 'person-name';
  name.tabIndex = -1;
  const identity = node('div', '', 'identity');
  identity.append(node('span', person.name[0], 'monogram'), name);
  if (person.alias) identity.append(node('span', '字 ' + person.alias, 'alias'));
  const facts = node('dl', '', 'facts');
  for (const [label, value] of [['生卒', person.years], ['居地', person.place]]) {
    const fact = node('div');
    fact.append(node('dt', label), node('dd', value || '未载'));
    facts.append(fact);
  }
  get('person').replaceChildren(
    node('p', `第 ${person.generation} 世 · ${person.branch}`, 'eyebrow'),
    identity,
    facts,
    button(`查看谱页样张 · 第 ${person.page} 页`, 'primary', () => openSource(person.page))
  );
  const groups = Object.entries(relatives(selected)).map(([label, members]) => {
    const group = node('section', '', 'relation-group');
    group.append(node('h3', label));
    if (!members.length) group.append(node('p', '当前样本未收录', 'muted'));
    for (const { person: relative, role, page } of members) {
      const row = node('div', '', 'relation');
      const link = button(relative.name, 'relative', () => choose(relative.id));
      link.append(node('span', `${role} · 第 ${relative.generation} 世 · ${relative.branch}`));
      const source = button('出处', 'quiet', () => openSource(page));
      source.setAttribute('aria-label', `${relative.name}的关系出处`);
      row.append(link, source);
      group.append(row);
    }
    return group;
  });
  get('relations').replaceChildren(...groups);
  get('back').disabled = !breadcrumb.length;
  renderList();
}

get('query').addEventListener('input', renderList);
get('back').addEventListener('click', () => {
  selected = breadcrumb.pop();
  render();
  get('person-name').focus();
});
get('zoom').addEventListener('click', () => setZoom(get('zoom').getAttribute('aria-pressed') !== 'true'));
get('stats').textContent = `${people.length} 位人物 · ${new Set(people.map(person => person.generation)).size} 世 · ${branches.length} 个支系`;
render();
