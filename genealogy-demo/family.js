'use strict';

const branches = [
  { name: '清溪本支', start: 'p4', description: '以沈承远为入口' },
  { name: '东桥支', start: 'p8', description: '由沈明礼一脉分出' }
];

const people = [
  { id: 'p1', name: '沈文柏', alias: '松年', generation: 1, branch: '清溪本支', years: '1812–1874', place: '清溪', page: 1 },
  { id: 'p2', name: '沈继安', alias: '守之', generation: 2, branch: '清溪本支', years: '1840–1901', place: '清溪', page: 1 },
  { id: 'p3', name: '沈明礼', alias: '敬修', generation: 3, branch: '清溪本支', years: '1868–1932', place: '清溪', page: 2 },
  { id: 'p4', name: '沈承远', alias: '思源', generation: 4, branch: '清溪本支', years: '1895–1960', place: '清溪', page: 2 },
  { id: 'p5', name: '许静兰', years: '1898–1971', generation: 4, branch: '清溪本支', page: 3 },
  { id: 'p6', name: '沈启文', generation: 5, branch: '清溪本支', years: '1921–1988', place: '清溪', page: 3 },
  { id: 'p7', name: '沈启华', generation: 5, branch: '清溪本支', years: '待核', place: '清溪', page: 3 },
  { id: 'p8', name: '沈承泽', alias: '润之', generation: 4, branch: '东桥支', years: '1900–1967', place: '东桥', page: 4 },
  { id: 'p9', name: '沈启文', alias: '学勤', generation: 5, branch: '东桥支', years: '1928–1997', place: '东桥', page: 4 }
];

const links = [
  ['p1', 'p2', '父亲', 1],
  ['p2', 'p3', '父亲', 2],
  ['p3', 'p4', '父亲', 2],
  ['p3', 'p8', '父亲', 4],
  ['p4', 'p5', '配偶', 3],
  ['p4', 'p6', '父亲', 3],
  ['p5', 'p6', '母亲', 3],
  ['p4', 'p7', '父亲', 3],
  ['p5', 'p7', '母亲', 3],
  ['p8', 'p9', '父亲', 4]
];

const byId = new Map(people.map(person => [person.id, person]));

function search(value) {
  const query = value.normalize('NFKC').trim();
  if (!query) return [];
  const rank = person => person.name === query || person.alias === query ? 0 : 1;
  return people.filter(person => [person.name, person.alias].some(name => name?.includes(query)))
    .sort((first, second) => rank(first) - rank(second));
}

function relatives(id) {
  const groups = { 父母: [], 配偶: [], 子女: [] };
  for (const [from, to, role, page] of links) {
    if (role === '配偶') {
      if (from === id || to === id) groups.配偶.push({ person: byId.get(from === id ? to : from), role, page });
    } else if (to === id) {
      groups.父母.push({ person: byId.get(from), role, page });
    } else if (from === id) {
      groups.子女.push({ person: byId.get(to), role: '子女', page });
    }
  }
  return groups;
}

function sourcePage(page) {
  return {
    people: people.filter(person => person.page === page),
    links: links.filter(link => link[3] === page)
  };
}

if (typeof module !== 'undefined') module.exports = { branches, people, links, byId, search, relatives, sourcePage };
