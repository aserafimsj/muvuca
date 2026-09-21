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
  'APROV_STATUS, APROV_CAMINHOS, APROV_FORMATOS, APROV_FILTRO_VAZIO, APROV_AGUARDANDO, APROV_EM_AJUSTE, aprovErro, ' +
  'tamanhoLegivel, arquivoAceito, caminhoDoArquivo, espacoUsado, trocarOrdem, ARQ_LIMITE, ARQ_TIPOS};');
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

/* ============================================================
   6. OS ARQUIVOS (etapa 2)
   ============================================================ */
console.log('\n--- tamanho em linguagem de gente ---');
check('900 bytes',      A.tamanhoLegivel(900) === '900 B', A.tamanhoLegivel(900));
check('meio mega',      A.tamanhoLegivel(512000) === '500 KB', A.tamanhoLegivel(512000));
check('1,4 MB com virgula', A.tamanhoLegivel(1468006) === '1,4 MB', A.tamanhoLegivel(1468006));
check('30 MB de um Reel', A.tamanhoLegivel(31457280) === '30,0 MB', A.tamanhoLegivel(31457280));
check('1 GB',           A.tamanhoLegivel(1073741824) === '1,00 GB', A.tamanhoLegivel(1073741824));
// Numero cru em byte nao diz nada; zero ou lixo tem que virar travessao, e
// nao "NaN B" na cara do usuario.
check('zero vira travessao',  A.tamanhoLegivel(0) === '—');
check('nulo vira travessao',  A.tamanhoLegivel(null) === '—');
check('lixo vira travessao',  A.tamanhoLegivel('abc') === '—');

console.log('\n--- o que pode subir ---');
const arq = (nome, tipo, tam) => ({name:nome, type:tipo, size:tam});
check('JPG passa',  A.arquivoAceito(arq('arte.jpg','image/jpeg', 500000)).ok === true);
check('PNG passa',  A.arquivoAceito(arq('card.png','image/png', 500000)).ok === true);
check('WEBP passa', A.arquivoAceito(arq('a.webp','image/webp', 500000)).ok === true);
check('GIF passa',  A.arquivoAceito(arq('a.gif','image/gif', 500000)).ok === true);
check('MP4 passa',  A.arquivoAceito(arq('reel.mp4','video/mp4', 30000000)).ok === true);
check('MOV passa',  A.arquivoAceito(arq('reel.mov','video/quicktime', 30000000)).ok === true);
check('imagem e marcada como imagem', A.arquivoAceito(arq('a.jpg','image/jpeg',1)).tipo === 'imagem');
check('video e marcado como video',   A.arquivoAceito(arq('a.mp4','video/mp4',1)).tipo === 'video');

console.log('\n--- e o que NAO pode, com o motivo ---');
const pdf = A.arquivoAceito(arq('briefing.pdf','application/pdf', 100000));
check('PDF e recusado', pdf.ok === false);
check('e o motivo diz o nome do arquivo', /briefing\.pdf/.test(pdf.motivo), pdf.motivo);
check('e diz o que serve',  /JPG, PNG/.test(pdf.motivo));
const psd = A.arquivoAceito(arq('arte.psd','', 100000));
check('arquivo sem tipo e recusado', psd.ok === false);
check('e nao quebra a mensagem', /desconhecido/.test(psd.motivo), psd.motivo);

const grande = A.arquivoAceito(arq('filme.mp4','video/mp4', A.ARQ_LIMITE + 1));
check('acima do limite e recusado', grande.ok === false);
// Recusar sem dizer o tamanho deixa a pessoa adivinhando quanto cortar.
check('e o motivo diz o tamanho dele e o limite',
  /50,0 MB/.test(grande.motivo) && /filme\.mp4/.test(grande.motivo), grande.motivo);
check('exatamente no limite ainda passa',
  A.arquivoAceito(arq('no-limite.mp4','video/mp4', A.ARQ_LIMITE)).ok === true);
check('nenhum arquivo e recusado sem explicacao',
  A.arquivoAceito(null).ok === false && A.arquivoAceito(null).motivo.length > 10);

console.log('\n--- o caminho dentro da area de arquivos ---');
const cam = A.caminhoDoArquivo(1, 34, 'Arte Final — Setembro (v2).jpg');
check('comeca pelo cliente e pela peca', /^1\/34\//.test(cam), cam);
check('tira acento e espaco',  !/[ áéíóúãõçÁ—]/.test(cam), cam);
check('guarda a extensao',     /\.jpg$/.test(cam), cam);
// Duas artes com o MESMO nome nao podem se sobrescrever — seria perder a
// arte de uma peca ao subir a de outra.
const a1 = A.caminhoDoArquivo(1, 34, 'capa.jpg');
const a2 = A.caminhoDoArquivo(1, 34, 'capa.jpg');
check('dois arquivos de mesmo nome nao colidem', a1 !== a2, a1 + ' vs ' + a2);
check('cliente diferente, pasta diferente',
  A.caminhoDoArquivo(2, 34, 'capa.jpg').startsWith('2/34/'));
check('nome vazio nao gera caminho quebrado',
  /^1\/34\/[a-z0-9]+-arquivo$/.test(A.caminhoDoArquivo(1, 34, '')),
  A.caminhoDoArquivo(1, 34, ''));

console.log('\n--- o espaco usado ---');
const e0 = A.espacoUsado([]);
check('sem arquivo, zero',        e0.usado === 0 && e0.pct === 0);
check('e nao esta apertado',      e0.apertado === false);
const e1 = A.espacoUsado([{tamanho:500*1024*1024}, {tamanho:100*1024*1024}]);
check('soma os tamanhos',         e1.pct === 59, String(e1.pct));
check('com 59% nao avisa',        e1.apertado === false);
const e2 = A.espacoUsado([{tamanho:900*1024*1024}]);
check('com 88% avisa',            e2.apertado === true, String(e2.pct));
check('o texto diz usado e total',/de 1,00 GB/.test(e2.texto), e2.texto);
check('tamanho nulo nao vira NaN',
  A.espacoUsado([{tamanho:null}, {tamanho:1024}]).usado === 1024);

console.log('\n--- a ordem do carrossel ---');
const cards = [{id:10, ordem:0}, {id:20, ordem:1}, {id:30, ordem:2}];
const subiu = A.trocarOrdem(cards, 20, -1);
check('subir troca com o de cima', subiu.map(a=>a.id).join(',') === '20,10,30', subiu.map(a=>a.id).join(','));
check('e renumera de 0 em diante', subiu.map(a=>a.ordem).join(',') === '0,1,2');
const desceu = A.trocarOrdem(cards, 20, 1);
check('descer troca com o de baixo', desceu.map(a=>a.id).join(',') === '10,30,20');
// Sem isso, clicar em "subir" no primeiro tiraria o card da lista.
check('o primeiro nao sobe',  A.trocarOrdem(cards, 10, -1) === null);
check('o ultimo nao desce',   A.trocarOrdem(cards, 30, 1) === null);
check('id que nao existe nao faz nada', A.trocarOrdem(cards, 99, 1) === null);
check('a lista original nao e alterada', cards.map(a=>a.id).join(',') === '10,20,30');
// Numeracao com buracos e empates acontece depois de remover arquivos.
// Renumerar sempre e o que impede a ordem de embaralhar sozinha.
const bagunca = [{id:1, ordem:5}, {id:2, ordem:5}, {id:3, ordem:9}];
const arrumado = A.trocarOrdem(bagunca, 3, -1);
check('ordem com buraco e empate e renumerada',
  arrumado.map(a=>a.ordem).join(',') === '0,1,2', arrumado.map(a=>a.ordem).join(','));

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
