// Testa a regra "este comentario passa no filtro?" sem navegador.
// passaNoFiltro e' uma funcao pura, entao da para cobrir todos os casos de
// borda de graca — inclusive os chatos, como comentario sem data.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Recorta as funcoes puras do arquivo. Se o recorte falhar, o teste quebra
// alto em vez de fingir que passou.
function recortar(nome, re){
  const m = html.match(re);
  if(!m){ console.error(`FALHA: nao achei ${nome} no index.html`); process.exit(2); }
  return m[0];
}
const fonte = [
  recortar('FILTRO_VAZIO', /const FILTRO_VAZIO = \{[\s\S]*?\};/),
  recortar('passaNoFiltro', /function passaNoFiltro\(i, f, busca\)\{[\s\S]*?\n\}/),
  recortar('rotuloPost', /function rotuloPost\(p\)\{[\s\S]*?\n\}/),
].join('\n');
// Dentro de uma funcao: sem isto, o eval declara no mesmo escopo em que
// estamos declarando as constantes abaixo, e os nomes colidem.
const { FILTRO_VAZIO, passaNoFiltro, rotuloPost } =
  eval('(function(){' + fonte + '\nreturn {FILTRO_VAZIO, passaNoFiltro, rotuloPost};})()');

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
const filtro = mud => ({...FILTRO_VAZIO, ...mud});

const COM = {
  id: 1, autor: 'valdirene', texto: 'Como faco para investir no Selic?',
  resposta: 'Oi! Voce precisa de CPF ativo.', sentimento_id: 4, rede_id: 1,
  produto_id: 2, editoria_id: 3, origem: 'Feed', link_conteudo: 'https://insta/p/abc',
  data_coment: '2026-09-15', ia_triagem: 'responder', ia_juridico: false,
};

console.log('--- sem filtro nenhum ---');
check('passa com filtro vazio', passaNoFiltro(COM, FILTRO_VAZIO, ''));

console.log('\n--- cada filtro isolado ---');
const casos = [
  ['sentimento certo',   {sent:'4'},              true],
  ['sentimento errado',  {sent:'2'},              false],
  ['rede certa',         {rede:'1'},              true],
  ['rede errada',        {rede:'9'},              false],
  ['produto certo',      {produto:'2'},           true],
  ['produto errado',     {produto:'1'},           false],
  ['editoria certa',     {editoria:'3'},          true],
  ['editoria errada',    {editoria:'1'},          false],
  ['origem certa',       {origem:'Feed'},         true],
  ['origem errada',      {origem:'DM'},           false],
  ['post certo',         {post:'https://insta/p/abc'}, true],
  ['post errado',        {post:'https://insta/p/xyz'}, false],
  ['IA sugeriu responder',    {iaTriagem:'responder'},     true],
  ['IA sugeriu outra coisa',  {iaTriagem:'nao_responder'}, false],
];
casos.forEach(([nome, mud, esperado]) =>
  check(nome, passaNoFiltro(COM, filtro(mud), '') === esperado));

console.log('\n--- juridico ---');
check('so juridicos exclui o comum', passaNoFiltro(COM, filtro({juridico:true}), '') === false);
check('so juridicos inclui o sensivel', passaNoFiltro({...COM, ia_juridico:true}, filtro({juridico:true}), '') === true);
check('desligado deixa os dois passarem', passaNoFiltro(COM, filtro({juridico:false}), '') === true);

console.log('\n--- datas ---');
check('dentro do intervalo',          passaNoFiltro(COM, filtro({de:'2026-09-01', ate:'2026-09-30'}), '') === true);
check('antes do inicio fica de fora', passaNoFiltro(COM, filtro({de:'2026-09-20'}), '') === false);
check('depois do fim fica de fora',   passaNoFiltro(COM, filtro({ate:'2026-09-10'}), '') === false);
check('no limite de baixo entra',     passaNoFiltro(COM, filtro({de:'2026-09-15'}), '') === true);
check('no limite de cima entra',      passaNoFiltro(COM, filtro({ate:'2026-09-15'}), '') === true);
// O caso chato: comentario sem data nao pode aparecer num recorte de datas.
const semData = {...COM, data_coment: null};
check('sem data fica fora do recorte',     passaNoFiltro(semData, filtro({de:'2026-09-01'}), '') === false);
check('sem data aparece quando nao ha recorte', passaNoFiltro(semData, FILTRO_VAZIO, '') === true);

console.log('\n--- busca ---');
check('acha no texto',       passaNoFiltro(COM, FILTRO_VAZIO, 'investir') === true);
check('acha no autor',       passaNoFiltro(COM, FILTRO_VAZIO, 'valdirene') === true);
check('acha na resposta',    passaNoFiltro(COM, FILTRO_VAZIO, 'CPF') === true);
check('nao liga para maiuscula', passaNoFiltro(COM, FILTRO_VAZIO, 'INVESTIR') === true);
check('nao acha o que nao existe', passaNoFiltro(COM, FILTRO_VAZIO, 'bitcoin') === false);
check('comentario sem autor nao quebra a busca',
  passaNoFiltro({...COM, autor:null, resposta:null}, FILTRO_VAZIO, 'investir') === true);

console.log('\n--- filtros somados (E, nao OU) ---');
check('dois que batem', passaNoFiltro(COM, filtro({sent:'4', origem:'Feed'}), '') === true);
check('um bate e outro nao', passaNoFiltro(COM, filtro({sent:'4', origem:'DM'}), '') === false);
check('filtro mais busca', passaNoFiltro(COM, filtro({sent:'4'}), 'investir') === true);
check('filtro bate mas busca nao', passaNoFiltro(COM, filtro({sent:'4'}), 'bitcoin') === false);

console.log('\n--- campos vazios nao viram coringa ---');
const vazio = {id:2, autor:null, texto:'oi', resposta:'', sentimento_id:null,
  rede_id:null, produto_id:null, editoria_id:null, origem:null,
  link_conteudo:null, data_coment:null, ia_triagem:null, ia_juridico:null};
check('sem sentimento nao entra em "Negativo"', passaNoFiltro(vazio, filtro({sent:'2'}), '') === false);
check('sem rede nao entra em "Instagram"',      passaNoFiltro(vazio, filtro({rede:'1'}), '') === false);
check('sem nada passa quando nao ha filtro',    passaNoFiltro(vazio, FILTRO_VAZIO, '') === true);

console.log('\n--- rotulo de post comprido ---');
check('link curto fica inteiro', rotuloPost('https://insta/p/abc') === 'insta/p/abc', rotuloPost('https://insta/p/abc'));
const longo = 'https://www.instagram.com/p/DEFGHIJKLMNOPQRSTUVWXYZ123456/?img_index=2';
check('link comprido e' + ' encurtado', rotuloPost(longo).length <= 42, rotuloPost(longo));
check('mantem o comeco e o fim', rotuloPost(longo).startsWith('instagram.com') && rotuloPost(longo).endsWith('img_index=2'), rotuloPost(longo));
check('dois posts do mesmo perfil nao viram o mesmo rotulo',
  rotuloPost('https://www.instagram.com/tesourodireto/p/AAAAAAAAAAAAAAAAAAAAAA/1111') !==
  rotuloPost('https://www.instagram.com/tesourodireto/p/AAAAAAAAAAAAAAAAAAAAAA/2222'));

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
