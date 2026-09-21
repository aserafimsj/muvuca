// Testa a aba Conteudos sem navegador. O caso central e o casamento entre
// comentario e post: na pratica o mesmo link chega escrito de varias formas,
// e comparar o texto cru faz a contagem dar zero em silencio.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function recortar(nome, re){
  const m = html.match(re);
  if(!m){ console.error(`FALHA: nao achei ${nome} no index.html`); process.exit(2); }
  return m[0];
}
const fonte = [
  recortar('chaveDoPost', /function chaveDoPost\(url\)\{[\s\S]*?\n\}/),
  recortar('mesmoPost',   /const mesmoPost = \(a, b\) => \{[\s\S]*?\n\};/),
  recortar('redeDoLink',  /function redeDoLink\(url\)\{[\s\S]*?\n\}/),
  recortar('embedDoPost', /function embedDoPost\(url\)\{[\s\S]*?\n\}/),
  recortar('metrica',     /function metrica\(p, base\)\{[\s\S]*?\n\}/),
].join('\n');
const { chaveDoPost, mesmoPost, redeDoLink, embedDoPost, metrica } =
  eval('(function(){' + fonte + '\nreturn {chaveDoPost, mesmoPost, redeDoLink, embedDoPost, metrica};})()');

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };

const POST = 'https://www.instagram.com/p/ABC123/';

console.log('--- o mesmo post escrito de varias formas ---');
// Todas estas sao o MESMO post. Comparando texto cru, so a primeira casaria,
// e as outras quatro sumiriam da contagem sem ninguem perceber.
const iguais = [
  ['identico',              'https://www.instagram.com/p/ABC123/'],
  ['sem barra no fim',      'https://www.instagram.com/p/ABC123'],
  ['sem www',               'https://instagram.com/p/ABC123/'],
  ['sem https',             'www.instagram.com/p/ABC123/'],
  ['com rabicho de campanha','https://www.instagram.com/p/ABC123/?utm_source=ig_web'],
  ['com espaco sobrando',   '  https://www.instagram.com/p/ABC123/  '],
  ['em maiusculas',         'HTTPS://WWW.INSTAGRAM.COM/P/ABC123/'],
  ['com ancora',            'https://www.instagram.com/p/ABC123/#comentarios'],
];
iguais.forEach(([nome, variante]) =>
  check(`casa: ${nome}`, mesmoPost(POST, variante) === true, chaveDoPost(variante)));

console.log('\n--- posts diferentes NAO podem casar ---');
const diferentes = [
  ['outro codigo',   'https://www.instagram.com/p/XYZ789/'],
  ['outra rede',     'https://www.facebook.com/p/ABC123/'],
  ['reel em vez de p','https://www.instagram.com/reel/ABC123/'],
];
diferentes.forEach(([nome, outro]) =>
  check(`nao casa: ${nome}`, mesmoPost(POST, outro) === false));

console.log('\n--- vazio nao pode casar com vazio ---');
// Se vazio casasse com vazio, TODO comentario sem link seria contado em TODO
// post sem link, e os numeros do mural viravam ficcao.
check('vazio com vazio', mesmoPost('', '') === false);
check('nulo com nulo', mesmoPost(null, null) === false);
check('nulo com post', mesmoPost(null, POST) === false);
check('so espacos', mesmoPost('   ', '   ') === false);

console.log('\n--- de que rede e o link ---');
[['Instagram','https://instagram.com/p/x'], ['Facebook','https://facebook.com/post/1'],
 ['Facebook','https://fb.watch/abc'], ['TikTok','https://tiktok.com/@a/video/1'],
 ['YouTube','https://youtu.be/abc']].forEach(([esperado, url]) =>
  check(`${url} e ${esperado}`, redeDoLink(url) === esperado, String(redeDoLink(url))));
check('link desconhecido nao chuta rede', redeDoLink('https://exemplo.com/x') === null);

console.log('\n--- mostrar o post dentro da pagina ---');
check('post do Instagram',  embedDoPost('https://www.instagram.com/p/ABC123/') === 'https://www.instagram.com/p/ABC123/embed');
check('reel do Instagram',  embedDoPost('https://www.instagram.com/reel/ABC123/') === 'https://www.instagram.com/reel/ABC123/embed');
check('"reels" vira "reel"', embedDoPost('https://www.instagram.com/reels/ABC123/') === 'https://www.instagram.com/reel/ABC123/embed');
check('Facebook usa o plugin', (embedDoPost('https://facebook.com/x/posts/1')||'').includes('plugins/post.php'));
check('link que nao da para mostrar devolve nada', embedDoPost('https://exemplo.com/x') === null);
check('link vazio nao quebra', embedDoPost('') === null && embedDoPost(null) === null);

console.log('\n--- somar organico e pago ---');
// A armadilha: "_org" quer dizer "o titulo nao dizia pago". Planilha com
// coluna unica joga tudo em _org e deixa _pago vazio. A soma acerta nos dois.
check('planilha com as duas colunas', metrica({curtidas_org:100, curtidas_pago:40}, 'curtidas') === 140);
check('planilha com uma coluna so (o pago fica vazio)',
  metrica({curtidas_org:140, curtidas_pago:null}, 'curtidas') === 140);
check('so a paga preenchida', metrica({curtidas_org:null, curtidas_pago:40}, 'curtidas') === 40);
check('zero e um numero, nao ausencia', metrica({curtidas_org:0, curtidas_pago:0}, 'curtidas') === 0);
// Diferenca que importa: sem dado nenhum devolve null, e a tela nao mostra a
// metrica. Devolver 0 diria "esse post teve zero curtidas", o que e mentira.
check('sem dado nenhum devolve vazio, nao zero',
  metrica({curtidas_org:null, curtidas_pago:null}, 'curtidas') === null);
check('coluna que nem existe devolve vazio', metrica({}, 'curtidas') === null);

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
