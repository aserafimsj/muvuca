// As contas do modulo de Aprovacao, sem navegador.
//
// O que este arquivo protege:
//   1. O mes. Andar de mes e a navegacao principal da tela, e a aritmetica
//      de mes e traicoeira: 31 de janeiro + 1 mes vira 3 de marco se voce
//      somar errado, e dezembro + 1 tem que virar janeiro do ano seguinte.
//   2. O resumo. Numero errado em painel nao aparece como erro — aparece
//      como um numero plausivel e errado.
//   3. Os caminhos de status. Todo estado precisa ter saida E volta; um
//      estado sem volta e uma peca presa por engano de clique.
//   4. Os filtros, somados com E e nao com OU.
const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1]
  .replace(/ReactDOM\.createRoot[\s\S]*?\);\s*$/, '');

// Roda o codigo da pagina num ambiente de mentira, so para alcancar as
// funcoes puras. React e Supabase viram bonecos: nada disso e usado aqui.
const compilado = babel.transform(src, {presets:['react']}).code;
const sandbox = {
  React: {createElement: () => null, useState: () => [null, () => {}], useEffect: () => {}},
  ReactDOM: {createRoot: () => ({render(){}})},
  window: {supabase: {createClient: () => ({from: () => ({}), auth: {}})}, location:{origin:'',pathname:''}},
  document: {getElementById: () => null},
  navigator: {},
};
sandbox.window.window = sandbox.window;
const fn = new Function('React','ReactDOM','window','document','navigator',
  compilado + '\n; return {mesDe, mesDeHoje, mesVizinho, nomeDoMes, passaAprov, resumoAprovacao, ' +
  'APROV_STATUS, APROV_CAMINHOS, APROV_FORMATOS, APROV_FILTRO_VAZIO, APROV_AGUARDANDO, APROV_EM_AJUSTE, aprovErro};');
const A = fn(sandbox.React, sandbox.ReactDOM, sandbox.window, sandbox.document, sandbox.navigator);

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };

/* ============================================================
   1. O MES
   ============================================================ */
console.log('--- de que mes e uma data ---');
check('data normal',        A.mesDe('2026-09-09') === '2026-09');
check('com hora junto',     A.mesDe('2026-09-09T10:00:00Z') === '2026-09');
check('sem data: null',     A.mesDe(null) === null);
check('vazio: null',        A.mesDe('') === null);
check('lixo: null',         A.mesDe('ontem') === null);
// Uma peca sem data nao pode cair em mes nenhum por engano: ela some da
// vista, e a tela precisa saber avisar que ela existe.
check('data pela metade: null', A.mesDe('2026') === null);

console.log('\n--- andar de mes ---');
check('setembro + 1 = outubro',  A.mesVizinho('2026-09', 1) === '2026-10');
check('setembro - 1 = agosto',   A.mesVizinho('2026-09',-1) === '2026-08');
// A virada do ano nos dois sentidos: e onde a conta ingenua erra.
check('dezembro + 1 = janeiro do ano seguinte', A.mesVizinho('2026-12', 1) === '2027-01');
check('janeiro - 1 = dezembro do ano anterior', A.mesVizinho('2026-01',-1) === '2025-12');
// Somar 1 mes a 31 de janeiro "estourando" para marco e o erro classico.
// A funcao ancora no dia 1 justamente para nao cair nisso.
check('janeiro + 1 = fevereiro, nunca marco',   A.mesVizinho('2026-01', 1) === '2026-02');
check('marco - 1 = fevereiro',                  A.mesVizinho('2026-03',-1) === '2026-02');
check('ir e voltar da no mesmo lugar',
  A.mesVizinho(A.mesVizinho('2026-12', 1), -1) === '2026-12');
check('doze passos avancam um ano',
  Array.from({length:12}).reduce(m => A.mesVizinho(m, 1), '2026-01') === '2027-01');

console.log('\n--- o nome do mes ---');
check('setembro com maiuscula', A.nomeDoMes('2026-09') === 'Setembro de 2026', A.nomeDoMes('2026-09'));
check('janeiro',                A.nomeDoMes('2027-01') === 'Janeiro de 2027', A.nomeDoMes('2027-01'));
check('o mes de hoje tem o formato certo', /^\d{4}-\d{2}$/.test(A.mesDeHoje()), A.mesDeHoje());

/* ============================================================
   2. O RESUMO DO PAINEL
   ============================================================ */
console.log('\n--- o resumo do mes ---');
const peca = (status, extra={}) => ({status, arquivado:false, data_prevista:'2026-09-09', ...extra});
const mesCheio = [
  peca('aprovado'), peca('aprovado'), peca('aprovado'),
  peca('enviado'), peca('visualizado'), peca('reenviado'),
  peca('ajuste_solicitado'), peca('em_alteracao'),
  peca('rascunho'), peca('em_revisao'),
];
const res = A.resumoAprovacao(mesCheio);
check('total = 10',        res.total === 10, String(res.total));
check('aprovados = 3',     res.aprovados === 3, String(res.aprovados));
// "com o cliente" sao TRES estados, nao um: enviado, visualizado e reenviado.
// Contar so "enviado" mostraria 1 e esconderia duas pecas paradas.
check('com o cliente = 3', res.aguardando === 3, String(res.aguardando));
check('em ajuste = 2',     res.ajuste === 2, String(res.ajuste));
check('ainda internos = 2',res.interno === 2, String(res.interno));
check('os grupos somam o total',
  res.aprovados + res.aguardando + res.ajuste + res.interno === res.total);
check('30% aprovado',      res.pct === 30, String(res.pct));

console.log('\n--- o resumo nao mente quando nao ha nada ---');
const vazio = A.resumoAprovacao([]);
check('total zero', vazio.total === 0);
// null, nao 0: "0% aprovado" num mes sem nenhuma peca da a impressao de
// atraso, quando o certo e "nada planejado ainda".
check('porcentagem e null, nao zero', vazio.pct === null, String(vazio.pct));

console.log('\n--- arquivado sai da conta ---');
const comArquivado = [...mesCheio, peca('aprovado', {arquivado:true}), peca('rascunho', {arquivado:true})];
const res2 = A.resumoAprovacao(comArquivado);
check('arquivado nao entra no total', res2.total === 10, String(res2.total));
check('nem nos aprovados',            res2.aprovados === 3, String(res2.aprovados));
check('e a porcentagem nao muda',     res2.pct === 30, String(res2.pct));

console.log('\n--- peca sem status vale como rascunho ---');
const semStatus = A.resumoAprovacao([{arquivado:false}, {status:null, arquivado:false}]);
check('as duas contam no total',   semStatus.total === 2, String(semStatus.total));
check('e caem em "ainda internos"',semStatus.interno === 2, String(semStatus.interno));

/* ============================================================
   3. OS CAMINHOS DE STATUS
   ============================================================ */
console.log('\n--- todo estado tem saida e volta ---');
const estados = Object.keys(A.APROV_STATUS);
check('os oito estados da especificacao existem', estados.length === 8, estados.join(', '));
['rascunho','em_revisao','enviado','visualizado','aprovado',
 'ajuste_solicitado','em_alteracao','reenviado'].forEach(e =>
  check(`estado "${e}" existe`, !!A.APROV_STATUS[e]));

estados.forEach(e => {
  const saidas = A.APROV_CAMINHOS[e];
  check(`"${e}" tem para onde ir`, Array.isArray(saidas) && saidas.length > 0);
});
// Todo destino tem que ser um estado que existe. Um botao que leva a um
// estado inventado deixa a peca sem rotulo e sem saida.
const destinosRuins = [];
Object.entries(A.APROV_CAMINHOS).forEach(([de, saidas]) => {
  saidas.forEach(([para]) => { if(!A.APROV_STATUS[para]) destinosRuins.push(`${de} -> ${para}`); });
});
check('nenhum botao leva a um estado inexistente', destinosRuins.length === 0, destinosRuins.join(', '));

// Nenhum estado pode ser um beco sem saida: de todos tem que dar para
// voltar atras, porque clique errado acontece.
const semVolta = estados.filter(e => {
  const saidas = (A.APROV_CAMINHOS[e] || []).map(s => s[0]);
  return !saidas.some(p => A.APROV_STATUS[p].ordem < A.APROV_STATUS[e].ordem
                        || p === 'em_alteracao' || p === 'em_revisao');
});
check('de todo estado da para voltar atras', semVolta.length === 0, semVolta.join(', '));

check('todo caminho tem um rotulo em portugues',
  Object.values(A.APROV_CAMINHOS).every(s => s.every(([,rot]) => typeof rot === 'string' && rot.length > 4)));

console.log('\n--- so um caminho em destaque por estado ---');
/* O botao verde diz "e por aqui que se segue". Dois verdes nao dizem nada,
   e um verde no caminho errado convida a desfazer trabalho pronto — foi o
   que aconteceu: "Reabrir para alteracao" numa peca JA APROVADA saia em
   verde, porque o destaque era deduzido da ordem dos estados, e
   "em_alteracao" vem depois de "aprovado" nessa ordem sem ser um avanco. */
Object.entries(A.APROV_CAMINHOS).forEach(([de, saidas]) => {
  const principais = saidas.filter(s => s[2] === true);
  if(de === 'aprovado'){
    check('"aprovado" nao tem caminho em destaque', principais.length === 0,
      principais.map(s => s[1]).join(', '));
  } else {
    check(`"${de}" tem exatamente um caminho em destaque`, principais.length === 1,
      principais.map(s => s[1]).join(', ') || 'nenhum');
  }
});
// E o destaque nunca pode ser um caminho de volta.
const destaqueParaTras = [];
Object.entries(A.APROV_CAMINHOS).forEach(([de, saidas]) => {
  saidas.filter(s => s[2]).forEach(([para, rot]) => {
    if(/voltar|cancelar|reabrir/i.test(rot)) destaqueParaTras.push(`${de}: ${rot}`);
  });
});
check('nenhum botao de "voltar" sai em destaque', destaqueParaTras.length === 0,
  destaqueParaTras.join(', '));

// Alcancabilidade: partindo de rascunho, da para chegar em todos.
const alcancados = new Set(['rascunho']);
for(let i = 0; i < estados.length + 1; i++){
  [...alcancados].forEach(e => (A.APROV_CAMINHOS[e] || []).forEach(([p]) => alcancados.add(p)));
}
check('partindo de rascunho da para chegar a todos os estados',
  alcancados.size === estados.length,
  estados.filter(e => !alcancados.has(e)).join(', ') || 'todos alcancaveis');

console.log('\n--- os grupos do painel cobrem os estados certos ---');
check('"com o cliente" = enviado, visualizado, reenviado',
  A.APROV_AGUARDANDO.slice().sort().join(',') === 'enviado,reenviado,visualizado');
check('"em ajuste" = ajuste_solicitado, em_alteracao',
  A.APROV_EM_AJUSTE.slice().sort().join(',') === 'ajuste_solicitado,em_alteracao');
check('todo estado dos grupos existe de verdade',
  [...A.APROV_AGUARDANDO, ...A.APROV_EM_AJUSTE].every(e => !!A.APROV_STATUS[e]));

/* ============================================================
   4. OS FILTROS
   ============================================================ */
console.log('\n--- os filtros ---');
const cfg = {redes:[{id:1,nome:'Instagram'}], produtos:[{id:7,nome:'Selic'}], editorias:[{id:3,nome:'Educativo'}]};
const c1 = {rede_id:1, editoria_id:3, produto_id:7, formato:'Carrossel', status:'enviado',
  titulo:'5 coisas que você precisa saber', legenda:'Você já conhece o Tesouro Selic?',
  hashtags:'#TesouroDireto', campanha:'Grandes Sonhos', observacoes:null};

check('filtro vazio deixa tudo passar', A.passaAprov(c1, A.APROV_FILTRO_VAZIO, cfg) === true);
check('rede certa passa',    A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, rede:'1'}, cfg) === true);
check('rede errada barra',   A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, rede:'2'}, cfg) === false);
check('formato certo passa', A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, formato:'Carrossel'}, cfg) === true);
check('formato errado barra',A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, formato:'Reels'}, cfg) === false);
check('status certo passa',  A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, status:'enviado'}, cfg) === true);
check('status errado barra', A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, status:'aprovado'}, cfg) === false);
check('editoria certa passa',A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, editoria:'3'}, cfg) === true);
check('produto certo passa', A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, produto:'7'}, cfg) === true);

// Filtros somados com E, nao com OU: rede certa + formato errado tem que
// barrar. Somar com OU faria "Instagram + Reels" mostrar todo o Instagram.
check('rede certa E formato errado: BARRA',
  A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, rede:'1', formato:'Reels'}, cfg) === false);
check('rede certa E formato certo: passa',
  A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, rede:'1', formato:'Carrossel'}, cfg) === true);

console.log('\n--- a busca ---');
check('acha no titulo',    A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'5 coisas'}, cfg) === true);
check('acha na legenda',   A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'tesouro selic'}, cfg) === true);
check('acha na hashtag',   A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'#tesourodireto'}, cfg) === true);
check('acha na campanha',  A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'grandes sonhos'}, cfg) === true);
check('nao liga para maiuscula', A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'VOCÊ JÁ'}, cfg) === true);
// Sem acento tem que achar com acento: ninguem digita "você" na busca.
check('nao liga para acento',    A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'voce ja conhece'}, cfg) === true);
check('o que nao existe nao acha',A.passaAprov(c1, {...A.APROV_FILTRO_VAZIO, busca:'bitcoin'}, cfg) === false);

// Campo vazio nao pode virar coringa: uma peca SEM titulo nao deve casar
// com qualquer busca.
const c2 = {rede_id:null, formato:null, status:'rascunho', titulo:null, legenda:null,
  hashtags:null, campanha:null, observacoes:null};
check('peca sem texto nenhum nao casa com busca',
  A.passaAprov(c2, {...A.APROV_FILTRO_VAZIO, busca:'qualquer coisa'}, cfg) === false);
check('e peca sem rede nao casa com filtro de rede',
  A.passaAprov(c2, {...A.APROV_FILTRO_VAZIO, rede:'1'}, cfg) === false);
check('mas passa no filtro vazio', A.passaAprov(c2, A.APROV_FILTRO_VAZIO, cfg) === true);

/* ============================================================
   5. FORMATOS E ERROS
   ============================================================ */
console.log('\n--- os formatos previstos ---');
['Feed','Carrossel','Reels','Stories','Vídeo'].forEach(f =>
  check(`formato "${f}" existe`, A.APROV_FORMATOS.includes(f)));
check('nenhum formato repetido', new Set(A.APROV_FORMATOS).size === A.APROV_FORMATOS.length);

console.log('\n--- erro do banco em portugues ---');
check('tabela faltando vira instrucao',
  /MIGRACAO-APROVACAO\.md/.test(A.aprovErro('relation "public.conteudos" does not exist')));
check('tabela de link faltando tambem',
  /MIGRACAO-APROVACAO\.md/.test(A.aprovErro('Could not find the table \'public.aprovacao_links\' in the schema cache')));
// Erro de outra natureza tem que passar inteiro: traduzir tudo para "rode a
// migracao" esconderia o problema de verdade.
check('outro erro passa inteiro',
  A.aprovErro('permission denied for table conteudos') === 'permission denied for table conteudos');

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
