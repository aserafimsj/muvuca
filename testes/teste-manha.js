// Testes da tela Manha, sem navegador e sem rede.
//
// O que este arquivo protege, em ordem de gravidade:
//
//   1. Que as regras da CVM vivem em UM lugar so. Se alguem copiar o texto
//      para outro arquivo, a classificacao e a resposta passam a divergir e
//      ninguem percebe.
//   2. Que a lista de palavras proibidas barra o que tem que barrar E deixa
//      passar as respostas certas. Um filtro que barra tudo e tao inutil
//      quanto um que nao barra nada.
//   3. Que uma sugestao barrada vira ESCALAR SEM TEXTO. Remendar o texto
//      seria o jeito de o problema voltar disfarcado.
//   4. Que o ingest nao aceita ninguem sem token, nao duplica e nao grava
//      resposta em item escalado.
//
// Nada aqui chama a Anthropic nem o Supabase: as duas sao substituidas por
// dublês. Teste que gasta dinheiro ninguem roda.
const fs = require('fs');
const path = require('path');

const API = path.join(__dirname, '..', 'api');
const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };

const regras     = require(path.join(API, '_regras.js'));
const proibidas  = require(path.join(API, '_proibidas.js'));
const token      = require(path.join(API, '_token.js'));
const suggest    = require(path.join(API, 'suggestReply.js'));

/* ============================================================
   1. AS REGRAS VIVEM EM UM LUGAR SO
   ============================================================ */
console.log('--- as regras da CVM estao em um arquivo so ---');

const fontes = {
  'classify.js':      fs.readFileSync(path.join(API, 'classify.js'), 'utf8'),
  'suggestReply.js':  fs.readFileSync(path.join(API, 'suggestReply.js'), 'utf8'),
  'manha/ingest.js':  fs.readFileSync(path.join(API, 'manha', 'ingest.js'), 'utf8'),
  'manha/index.js':   fs.readFileSync(path.join(API, 'manha', 'index.js'), 'utf8'),
};

// Um pedaco textual das regras que so pode existir dentro de _regras.js.
const TRECHO = 'NUNCA prometa retorno garantido';
Object.entries(fontes).forEach(([nome, src]) => {
  check(`${nome} nao tem copia do texto das regras`, !src.includes(TRECHO));
});
check('_regras.js tem o texto', regras.REGRAS_TESOURO_DIRETO.includes(TRECHO));

check('classify.js importa as regras',   /require\(['"]\.\/_regras\.js['"]\)/.test(fontes['classify.js']));
check('suggestReply.js importa as regras',/require\(['"]\.\/_regras\.js['"]\)/.test(fontes['suggestReply.js']));

// A mesma constante, nao duas parecidas.
check('classify e suggestReply usam a MESMA regra para o Tesouro',
  regras.regrasDe('Tesouro Direto') === regras.REGRAS_TESOURO_DIRETO);
check('cliente qualquer nao recebe as regras da CVM',
  regras.regrasDe('Padaria do Ze') === regras.REGRAS_GENERICAS);

/* ============================================================
   2. OS DOZE TIPOS DE DM E A LISTA DO "PARE"
   ============================================================ */
console.log('\n--- os doze tipos de DM estao no prompt ---');

const sysTD  = suggest.montarSystem('Tesouro Direto', 'dm');
const sysTDf = suggest.montarSystem('Tesouro Direto', 'feed');
const sysOut = suggest.montarSystem('Padaria do Ze', 'dm');

// Cada tipo com um trecho que so aparece nele. Se alguem apagar um exemplo
// sem querer, o teste diz qual.
const TIPOS = [
  ['1. como comecar',        'Para começar você precisa de CPF ativo'],
  ['2. qual titulo escolher','Depende do seu objetivo e do prazo'],
  ['3. quanto rende',        'As taxas mudam todo dia'],
  ['4. pelo banco X',        'varia conforme a instituição'],
  ['5. resgate antecipado',  'recompra pelo preço do dia'],
  ['6. problema tecnico',    'resolvidas pelo atendimento oficial'],
  ['7. Reserva / Educa+',    'liberado aos poucos pelas instituições'],
  ['8. poupanca / CDB',      'comparar prazo, liquidez e imposto'],
  ['9. elogio',              'Que bom ler isso'],
  ['10. critica legitima',   'Entendo a sua frustração'],
  ['11. spam / bot',         'ESCALAR: spam, não responder'],
  ['12. comparacao aposta',  'investimento em título público'],
];
TIPOS.forEach(([nome, trecho]) => check(`tipo ${nome}`, sysTD.includes(trecho)));
check('os doze exemplos valem tambem para comentario no feed',
  TIPOS.every(([,t]) => sysTDf.includes(t)));
check('outro cliente NAO recebe os exemplos do Tesouro',
  TIPOS.every(([,t]) => !sysOut.includes(t)));

console.log('\n--- a lista do PARE esta inteira no prompt ---');
const PARE = [
  'Tema político, eleitoral ou de governo',
  'Crise, acusação grave, ameaça de processo',
  'Pedido de recomendação personalizada',
  'Qualquer dado pessoal na conversa',
  'Suspeita de golpe',
  'Comparação com apostas feita em tom de ataque',
  'Spam, bot, corrente, divulgação de outro perfil',
  'responderia com uma suposição em vez de um fato',
];
PARE.forEach(t => check(`PARE: ${t.slice(0,34)}…`, sysTD.includes(t)));
check('e manda escalar na duvida', /Na dúvida entre responder e escalar, ESCALE/.test(sysTD));

console.log('\n--- o prompt diz que nao envia nada ---');
check('o prompt avisa que a resposta e para uma pessoa revisar',
  /NÃO envia nada|para uma pessoa revisar/i.test(sysTD));
check('comentario no feed avisa que e publico', /PÚBLICO no feed/.test(sysTDf));
check('DM avisa que e reservado', /mensagem privada/.test(sysTD));

/* ============================================================
   3. A LISTA DE PALAVRAS PROIBIDAS
   ============================================================ */
console.log('\n--- o que TEM que ser barrado ---');
const BARRAR = [
  'É um investimento garantido, pode confiar.',
  'Aqui o retorno é garantido.',
  'No Tesouro o lucro é certo.',
  'É dinheiro certo no fim do mês.',
  'Você investe sem erro nenhum.',
  'É um investimento sem risco.',
  'Aqui o risco é zero.',
  'Não tem como perder dinheiro.',
  'Pode investir que não tem risco.',
  'É o melhor investimento do Brasil.',
  'Procura um investimento seguro? É esse.',
  'É 100% seguro.',
  'O Tesouro Selic rende 12% ao ano.',
  'No fim das contas o retorno é certo.',
  'Você vai ganhar R$ 500 por mês.',
  'Garante o retorno no vencimento.',
  // acento e espaco tortos, como o texto chega de verdade
  'Investimento garantído, sem  risco.',
  'Nao tem como perder.',
  // nome de instituicao
  'Você pode investir pelo Nubank.',
  'Abra conta na XP Investimentos.',
  'No app do Itaú você acha.',
  'Pelo Banco do Brasil também dá.',
];
BARRAR.forEach(t => {
  const v = proibidas.verificar(t);
  check(`barra: "${t.slice(0,42)}…"`, v.limpo === false, v.motivo || 'PASSOU DIRETO');
});
check('sao pelo menos 3 bloqueios diferentes',
  new Set(BARRAR.map(t => proibidas.verificar(t).motivo)).size >= 3);

console.log('\n--- e o que NAO pode ser barrado (as respostas certas) ---');
/* Estas sao as doze respostas modelo, tiradas do proprio prompt. Se o filtro
   barrar alguma, ele esta apertado demais e vai mandar escalar resposta boa
   — que e o jeito silencioso de a tela virar uma lista de ESCALAR. */
const PASSAR = [
  'Oi, @fulano! 💙 Para começar você precisa de CPF ativo e conta em uma instituição financeira habilitada.',
  'Para guardar com liquidez diária, o Tesouro Selic acompanha a Selic e você resgata quando quiser.',
  'As taxas mudam todo dia e ficam sempre atualizadas no site oficial.',
  'Isso varia conforme a instituição. O melhor caminho é consultar no app ou no site da sua corretora.',
  'Dá, sim. O Tesouro recompra pelo preço do dia, que pode estar acima ou abaixo do da compra.',
  'Sinto muito pelo transtorno. Questões de cadastro, login e resgate são resolvidas pelo atendimento oficial.',
  'O Tesouro Reserva está sendo liberado aos poucos pelas instituições.',
  'São produtos diferentes e vale comparar prazo, liquidez e imposto, não só o número do rendimento.',
  'Que bom ler isso, @fulano! 💙 Obrigado por acompanhar a gente.',
  'Entendo a sua frustração e obrigado por contar.',
  'Aqui é investimento em título público, com regras claras e prazo definido.',
  'No Prefixado, você já sabe quanto vai receber se levar até o vencimento.',
  'O Tesouro IPCA+ acompanha e supera a inflação.',
  // "banco" e "corretora" como palavra comum PRECISAM passar: a resposta
  // certa para "posso investir pelo banco X?" usa as duas.
  'Consulte o app do seu banco ou da sua corretora para ver quais títulos estão disponíveis.',
  '',
];
PASSAR.forEach(t => {
  const v = proibidas.verificar(t);
  check(`passa: "${(t||'(vazio)').slice(0,42)}…"`, v.limpo === true, v.motivo || '');
});

console.log('\n--- uma sugestao barrada vira ESCALAR SEM TEXTO ---');
const barrada = proibidas.filtrar({
  label:{triagem:'responder'}, reply:'É um investimento garantido!',
  escalate:false, escalateReason:null,
});
check('a resposta e descartada, nao remendada', barrada.reply === null,
  JSON.stringify(barrada.reply));
check('vira escalada', barrada.escalate === true);
check('o motivo explica o porque', /linguagem proibida/.test(barrada.escalateReason||''),
  barrada.escalateReason);
check('o motivo diz QUAL palavra', /garantido/.test(barrada.escalateReason||''));

const boa = proibidas.filtrar({
  label:{triagem:'responder'}, reply:'Oi, @fulano! O simulador ajuda a comparar.',
  escalate:false, escalateReason:null,
});
check('sugestao limpa passa intacta', boa.reply === 'Oi, @fulano! O simulador ajuda a comparar.' && boa.escalate === false);

const jaEscalada = proibidas.filtrar({ label:null, reply:null, escalate:true, escalateReason:'tema político' });
check('quem ja estava escalado continua com o motivo original',
  jaEscalada.escalate === true && jaEscalada.escalateReason === 'tema político');

/* ============================================================
   4. O CLASSIFY TAMBEM PASSA PELO FILTRO
   ============================================================ */
console.log('\n--- o classify filtra o rascunho dele ---');
check('classify.js importa a verificacao',
  /require\(['"]\.\/_proibidas\.js['"]\)/.test(fontes['classify.js']));
check('e chama verificar no rascunho',
  /verificar\(r\.rascunho\)/.test(fontes['classify.js']));
check('descartando o texto em vez de remenda-lo',
  /r\.rascunho\s*=\s*""/.test(fontes['classify.js']));
check('e acendendo a etiqueta Juridico/STN',
  /r\.needsLegal\s*=\s*true/.test(fontes['classify.js']));

/* ============================================================
   5. NENHUM CAMINHO DE ENVIO
   ============================================================ */
console.log('\n--- nada no sistema envia mensagem ---');
const ENVIO = [
  /graph\.facebook\.com/i,
  /graph\.instagram\.com/i,
  /\/messages\b[^\n]*instagram/i,
  /sendMessage|send_message|enviarDM|postComment/i,
];
Object.entries(fontes).forEach(([nome, src]) => {
  const achou = ENVIO.filter(re => re.test(src));
  check(`${nome} nao tem caminho de envio`, achou.length === 0, achou.join(' '));
});
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
check('index.html nao tem caminho de envio',
  !ENVIO.some(re => re.test(html)));

/* ============================================================
   6. A SENHA DA VARREDURA
   ============================================================ */
console.log('\n--- token: quem nao tem, nao entra ---');
const req = (cab) => ({ headers: cab ? {authorization: cab} : {} });
const antes = process.env.MANHA_TOKEN;
process.env.MANHA_TOKEN = 'senha-de-teste-bem-comprida';

check('sem cabecalho: barrado',      token.autorizado(req()).ok === false);
check('cabecalho sem Bearer: barrado',token.autorizado(req('senha-de-teste-bem-comprida')).ok === false);
check('token errado: barrado',        token.autorizado(req('Bearer senha-errada-bem-comprida')).ok === false);
check('token de tamanho diferente: barrado', token.autorizado(req('Bearer senha')).ok === false);
check('token certo: entra',           token.autorizado(req('Bearer senha-de-teste-bem-comprida')).ok === true);
check('"bearer" minusculo tambem vale',token.autorizado(req('bearer senha-de-teste-bem-comprida')).ok === true);

delete process.env.MANHA_TOKEN;
check('sem MANHA_TOKEN configurada, NINGUEM entra',
  token.autorizado(req('Bearer senha-de-teste-bem-comprida')).ok === false);
check('e o motivo diz o que falta',
  /MANHA_TOKEN/.test(token.autorizado(req('Bearer x')).motivo));
process.env.MANHA_TOKEN = antes;

check('a leitura tambem pede token',
  /autorizado\(req\)/.test(fontes['manha/index.js']),
  'sem isso, qualquer um le os comentarios de um cliente inteiro');

/* ============================================================
   7. O INGEST — com Supabase e IA de mentira
   ============================================================ */
console.log('\n--- o ingest: autenticacao, duplicados e escalada ---');

// Dubles instalados ANTES de carregar o ingest, porque ele desestrutura
// sugerir() no require.
const banco = require(path.join(API, '_banco.js'));
let GRAVADO = [];
let EXISTENTES = [];
banco.configurado = () => true;
banco.buscar = async (tabela, filtros) => {
  if (tabela === 'clientes') return filtros.id === 'eq.1' ? [{id:1, nome:'Tesouro Direto'}] : [];
  if (tabela === 'manha_items') return EXISTENTES;
  return [];
};
banco.inserir = async (tabela, linhas) => { GRAVADO = GRAVADO.concat(linhas); return linhas; };

let CHAMADAS_IA = 0;
suggest.sugerir = async ({ text }) => {
  CHAMADAS_IA++;
  if (/política|eleição/i.test(text)) {
    return { label:{triagem:'nao_responder'}, reply:null, escalate:true, escalateReason:'tema político' };
  }
  return { label:{triagem:'responder', motivo:'duvida'}, reply:'Oi! O simulador ajuda.', escalate:false, escalateReason:null };
};

const ingest = require(path.join(API, 'manha', 'ingest.js'));
const leitura = require(path.join(API, 'manha', 'index.js'));

function resFalso(){
  const o = { codigo:null, corpo:null };
  o.status = (c) => { o.codigo = c; return o; };
  o.json   = (b) => { o.corpo = b; return o; };
  return o;
}
const TOK = 'senha-de-teste-bem-comprida';
process.env.MANHA_TOKEN = TOK;
const post = (body, cab = 'Bearer ' + TOK) =>
  ({ method:'POST', headers: cab ? {authorization: cab} : {}, body });

(async () => {
  // --- autenticacao
  let res = resFalso();
  await ingest(post({clienteId:1, items:[{source:'feed', externalId:'a', text:'oi'}]}, null), res);
  check('POST sem token: 401', res.codigo === 401, JSON.stringify(res.corpo));
  check('e nada foi gravado', GRAVADO.length === 0);
  check('e nao gastou IA', CHAMADAS_IA === 0);

  res = resFalso();
  await ingest(post({clienteId:1, items:[{source:'feed', externalId:'a', text:'oi'}]}, 'Bearer errado'), res);
  check('POST com token errado: 401', res.codigo === 401);
  check('continua sem gastar IA', CHAMADAS_IA === 0);

  // --- cliente inexistente
  res = resFalso();
  await ingest(post({clienteId:99, items:[{source:'feed', externalId:'a', text:'oi'}]}), res);
  check('cliente que nao existe: 400', res.codigo === 400, JSON.stringify(res.corpo));
  check('o token nao e procuracao para qualquer cliente', CHAMADAS_IA === 0);

  // --- lote grande demais
  res = resFalso();
  const gigante = Array.from({length: ingest.LOTE_MAXIMO + 1}, (_,i) => ({source:'feed', externalId:'x'+i, text:'oi'}));
  await ingest(post({clienteId:1, items: gigante}), res);
  check('lote acima do maximo: 400', res.codigo === 400, JSON.stringify(res.corpo));
  check('trava de custo: nao chamou a IA nenhuma vez', CHAMADAS_IA === 0);

  // --- caminho feliz, com duplicado DENTRO do mesmo lote
  GRAVADO = []; EXISTENTES = []; CHAMADAS_IA = 0;
  res = resFalso();
  await ingest(post({clienteId:1, items:[
    {source:'feed', externalId:'c1', author:'ana',  text:'Como invisto?'},
    {source:'feed', externalId:'c1', author:'ana',  text:'Como invisto?'},   // repetido no lote
    {source:'dm',   externalId:'d1', author:'joao', text:'Dá para resgatar antes?'},
    {source:'dm',   externalId:'d2', author:'ze',   text:'O que acha da política econômica?'},
    {source:'feed', externalId:null, author:'sem',  text:'sem id'},          // sem externalId
  ]}), res);
  check('caminho feliz: 200', res.codigo === 200, JSON.stringify(res.corpo));
  check('gravou 3 (o repetido do lote nao entra)', res.corpo.new === 3, String(res.corpo.new));
  check('a IA foi chamada 3 vezes, nao 5', CHAMADAS_IA === 3, String(CHAMADAS_IA));
  check('contou 1 sem externalId', res.corpo.skipped === 1, String(res.corpo.skipped));
  check('contou 1 duplicado', res.corpo.duplicates === 1, String(res.corpo.duplicates));
  check('contou 1 escalado', res.corpo.escalated === 1, String(res.corpo.escalated));
  check('o resumo da manha sai pronto', /3 novidade\(s\)/.test(res.corpo.resumo), res.corpo.resumo);

  const escalado = GRAVADO.find(g => g.external_id === 'd2');
  check('item escalado foi gravado SEM resposta', escalado && escalado.reply === null,
    escalado ? JSON.stringify(escalado.reply) : 'nao gravou');
  check('item escalado guarda o motivo', escalado && escalado.escalate_reason === 'tema político');
  check('item normal foi gravado COM resposta',
    GRAVADO.find(g => g.external_id === 'c1').reply === 'Oi! O simulador ajuda.');
  check('tudo entra como pendente', GRAVADO.every(g => g.status === 'pendente'));
  check('e amarrado ao cliente certo', GRAVADO.every(g => g.cliente_id === 1));

  // --- reenviar o MESMO lote nao duplica nem cobra de novo
  EXISTENTES = GRAVADO.map(g => ({source:g.source, external_id:g.external_id}));
  const antesIA = CHAMADAS_IA;
  GRAVADO = [];
  res = resFalso();
  await ingest(post({clienteId:1, items:[
    {source:'feed', externalId:'c1', text:'Como invisto?'},
    {source:'dm',   externalId:'d1', text:'Dá para resgatar antes?'},
  ]}), res);
  check('reenviar o mesmo lote: nada novo', res.corpo.new === 0, String(res.corpo.new));
  check('e nao gastou IA de novo', CHAMADAS_IA === antesIA, `${CHAMADAS_IA} vs ${antesIA}`);
  check('e nao gravou nada', GRAVADO.length === 0);
  check('o resumo diz que nao houve novidade', /Nada novo/.test(res.corpo.resumo), res.corpo.resumo);

  // --- a leitura
  console.log('\n--- a leitura ---');
  const get = (query, cab = 'Bearer ' + TOK) => ({ method:'GET', query, headers: cab?{authorization:cab}:{} });
  EXISTENTES = [
    {id:1, source:'feed', status:'pendente',   escalate:false},
    {id:2, source:'dm',   status:'pendente',   escalate:true},
    {id:3, source:'dm',   status:'respondido', escalate:false},
  ];
  res = resFalso();
  await leitura(get({clienteId:'1'}, null), res);
  check('GET sem token: 401', res.codigo === 401);

  res = resFalso();
  await leitura(get({clienteId:'1'}), res);
  check('GET com token: 200', res.codigo === 200, JSON.stringify(res.corpo && res.corpo.error));
  check('o resumo conta so a fila', res.corpo.resumo.pendentes === 2, String(res.corpo.resumo.pendentes));
  check('separa comentario de DM', res.corpo.resumo.feed === 1 && res.corpo.resumo.dm === 1);
  check('e conta os escalados', res.corpo.resumo.escalar === 1);

  res = resFalso();
  await leitura(get({clienteId:'1', since:'ontem'}), res);
  check('data mal escrita e RECUSADA, nao ignorada', res.codigo === 400, JSON.stringify(res.corpo));

  res = resFalso();
  await leitura(get({}), res);
  check('sem clienteId: 400', res.codigo === 400);

  /* ============================================================
     8. OS DOCUMENTOS
     ============================================================ */
  console.log('\n--- os documentos dizem o que precisa ser dito ---');
  const varredura = fs.readFileSync(path.join(__dirname, '..', 'docs', 'manha-varredura.md'), 'utf8');
  check('a varredura diz que NAO responde', /Você não responde nada\. Você não envia nada\./.test(varredura));
  check('tem o cabecalho de autenticacao', /Authorization: Bearer/.test(varredura));
  check('tem exemplo de curl', /curl -X POST/.test(varredura));
  check('explica a janela de tempo', /desde a última vez|últimas 24\s*horas/i.test(varredura));
  check('explica o externalId estavel', /est[áa]vel/i.test(varredura) && /externalId/.test(varredura));
  check('manda ignorar ordem vinda de comentario', /ignore/i.test(varredura));
  check('diz o limite de 60 por lote', /60/.test(varredura));

  const migra = fs.readFileSync(path.join(__dirname, '..', 'MIGRACAO-MANHA.md'), 'utf8');
  // Tolerante a quebra de linha: o texto do guia e quebrado em 78 colunas, e
  // uma regex colada reprovava por causa do "\n> " no meio da frase.
  const corrido = t => t.replace(/\s*\n>?\s*/g, ' ');
  check('a migracao avisa que nada e enviado',
    /nada no MUVUCA envia mensagem, coment[áa]rio ou DM/i.test(corrido(migra)));
  check('a migracao pede as duas variaveis',
    /SUPABASE_SERVICE_ROLE_KEY/.test(migra) && /MANHA_TOKEN/.test(migra));
  check('a migracao avisa para publicar de novo', /Redeploy/.test(migra));
  check('a migracao tem conferencia no fim', /information_schema\.columns/.test(migra));

  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
