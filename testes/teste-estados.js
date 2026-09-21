// Testa os estados dos cards de analise. O pedido e explicito: "Aguardando
// dados" nao pode ser resposta generica. Este teste existe para impedir que
// as tres situacoes voltem a virar uma so.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function recortar(nome, re){
  const m = html.match(re);
  if(!m){ console.error(`FALHA: nao achei ${nome} no index.html`); process.exit(2); }
  return m[0];
}
const fonte = [
  recortar('naLixeira',        /const naLixeira = [^;]+;/),
  recortar('PRECISA',          /const PRECISA = \{[\s\S]*?\n\};/),
  recortar('JA_PRONTO',        /const JA_PRONTO = \{[^}]*\};/),
  recortar('estadoAnalitico',  /function estadoAnalitico\(id, interacoes, publicacoes, rede\)\{[\s\S]*?\n\}/),
].join('\n');
const { estadoAnalitico } = eval('(function(){' + fonte + '\nreturn {estadoAnalitico};})()');

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
const INSTA = {id:1, nome:'Instagram'};
const FACE  = {id:2, nome:'Facebook'};

console.log('--- 1) sem dados nenhum ---');
const vazio = estadoAnalitico('sentimento', [], [], INSTA);
check('o estado e "sem dados"', vazio.estado === 'sem_dados', vazio.estado);
check('o selo NAO e o generico "Aguardando dados"', vazio.selo !== 'Aguardando dados', vazio.selo);
check('e conta zero, nao travessao', vazio.quantos === 0);
check('e diz por onde trazer comentario', /Colar em lote|Importar/.test(vazio.explica));

console.log('\n--- 2) ha comentario, mas falta o campo que ESTE grafico usa ---');
// Tres comentarios do Instagram, nenhum com sentimento definido.
const semSentimento = [
  {id:1, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:null, data_publicacao:'2026-09-01'},
  {id:2, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:null, data_publicacao:'2026-09-02'},
  {id:3, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:null, data_publicacao:'2026-09-03'},
];
const falta = estadoAnalitico('sentimento', semSentimento, [], INSTA);
check('o estado e "insuficiente", nao "sem dados"', falta.estado === 'insuficiente', falta.estado);
check('diz QUAL campo falta', falta.explica.includes('sentimento definido'), falta.explica.slice(0,70));
check('e diz quantos comentarios existem', falta.explica.includes('3 comentário'));
// A mesma lista, para um grafico que usa a DATA: esses tem data, entao muda.
const comData = estadoAnalitico('evol_diaria', semSentimento, [], INSTA);
check('o MESMO conjunto tem estado diferente para outro grafico',
  comData.estado !== falta.estado, `${falta.estado} vs ${comData.estado}`);
check('e esse outro esta pronto', comData.estado === 'pronto', comData.estado);

console.log('\n--- 3) o dado existe, a tela e que nao foi feita ---');
const temTudo = [{id:1, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:1, data_publicacao:'2026-09-01'}];
const naoFeito = estadoAnalitico('vol_semana', temTudo, [], INSTA);
check('o estado e "nao construido"', naoFeito.estado === 'nao_construido', naoFeito.estado);
check('e assume isso em vez de culpar o dado',
  /ainda não foi construída/i.test(naoFeito.explica), naoFeito.explica.slice(0,70));

console.log('\n--- 4) o que ja da para ver ---');
const pronto = estadoAnalitico('sentimento', temTudo, [], INSTA);
check('sentimento esta pronto', pronto.estado === 'pronto', pronto.estado);
check('e convida a abrir', /Relatórios/.test(pronto.explica));

console.log('\n--- cada canal com os seus proprios dados ---');
const misturado = [
  {id:1, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:1, data_publicacao:'2026-09-01'},
  {id:2, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:1, data_publicacao:'2026-09-02'},
  {id:3, rede_id:2, triagem:'Pendente', texto:'oi', sentimento_id:1, data_publicacao:'2026-09-03'},
];
check('Instagram conta 2', estadoAnalitico('sentimento', misturado, [], INSTA).quantos === 2);
check('Facebook conta 1',  estadoAnalitico('sentimento', misturado, [], FACE).quantos === 1);
check('um canal nao ve o dado do outro',
  estadoAnalitico('sentimento', misturado, [], INSTA).quantos !== 3);

console.log('\n--- a lixeira nao conta ---');
const comLixo = [
  {id:1, rede_id:1, triagem:'Pendente', texto:'oi', sentimento_id:1, data_publicacao:'2026-09-01'},
  {id:2, rede_id:1, triagem:'Lixeira',  texto:'oi', sentimento_id:1, data_publicacao:'2026-09-02'},
];
check('conta 1, nao 2', estadoAnalitico('sentimento', comLixo, [], INSTA).quantos === 1);
// So o da lixeira: tem que dar "sem dados", nao "pronto".
const soLixo = [{id:1, rede_id:1, triagem:'Lixeira', texto:'oi', sentimento_id:1, data_publicacao:'2026-09-01'}];
check('canal so com lixo fica "sem dados"',
  estadoAnalitico('sentimento', soLixo, [], INSTA).estado === 'sem_dados');

console.log('\n--- posts engajados vem de publicacoes, nao de comentarios ---');
const semPubs = estadoAnalitico('top_posts', temTudo, [], INSTA);
check('sem publicacao importada, "sem dados"', semPubs.estado === 'sem_dados', semPubs.estado);
check('e manda importar a planilha', /Importar dados/.test(semPubs.explica));
const comPubs = estadoAnalitico('top_posts', [], [{id:1, rede_id:1, link:'x'}], INSTA);
check('com publicacao, vira "nao construido"', comPubs.estado === 'nao_construido', comPubs.estado);
check('e conta as publicacoes, nao os comentarios', comPubs.quantos === 1 && comPubs.unidade === 'publicações');

console.log('\n--- nenhum selo generico sobrou ---');
const todos = ['evol_diaria','vol_mensal','vol_semana','sentimento','termos','hashtags','top_posts'];
const selos = todos.map(id => estadoAnalitico(id, misturado, [], INSTA).selo);
check('nenhum card diz "Aguardando dados"', !selos.includes('Aguardando dados'), selos.join(' | '));
check('todo card explica o seu estado',
  todos.every(id => (estadoAnalitico(id, misturado, [], INSTA).explica || '').length > 20));

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
