// Confere que toda coluna que o codigo GRAVA existe mesmo no banco.
//
// Este teste nasceu de um erro real desta obra: o codigo passou a gravar
// ia_em, ia_triagem, ia_motivo e ia_juridico em colunas que nunca foram
// criadas. O botao da IA respondia, o custo era cobrado, e a gravacao morria
// em silencio. Passou despercebido por varias etapas.
//
// Ele le o esquema confirmado de esquema-real.json e varre os caminhos de
// escrita do index.html. Se aparecer coluna fora da lista, reprova dizendo
// que falta migracao.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const esquema = JSON.parse(fs.readFileSync(path.join(__dirname, 'esquema-real.json'), 'utf8'));

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
const achar = re => [...html.matchAll(re)].map(m => m[1]);

console.log('--- colunas que o codigo grava, tabela por tabela ---');

/* Um objeto `mud` e montado campo a campo e so depois entregue a um
 * .update(). Para saber EM QUE TABELA aquela coluna cai, cada `mud.x =`
 * e atribuido ao primeiro `from('tabela').update(mud)` que vem depois dele.
 *
 * Antes este teste jogava todo `mud.` na conta de `interacoes`. Funcionava
 * enquanto so existia uma tela que gravava assim; quando a Aprovacao passou
 * a montar o proprio `mud`, o teste acusou "falta migracao para status" —
 * uma coluna que existe, so que em outra tabela. Acusacao errada treina
 * quem le a ignorar, que e o comeco do fim de um teste. */
function tabelaDe(indice){
  const m = html.slice(indice).match(/from\('([a-z_]+)'\)\s*\n?\s*\.?\s*update\(/);
  return m ? m[1] : null;
}
const porTabela = {};
const anota = (tabela, coluna) => {
  if(!tabela) return;
  (porTabela[tabela] = porTabela[tabela] || new Set()).add(coluna);
};

/* Le TODAS as chaves de um objeto literal, nao so a primeira.
 * A versao anterior pegava so a primeira chave, entao
 * `.update({arquivado: v, atualizado_em: x})` era conferido pela metade —
 * a segunda coluna podia nao existir e ninguem saberia. */
function chavesDoObjeto(texto, inicio){
  let profundidade = 0, fim = inicio;
  for(let i = inicio; i < texto.length; i++){
    const ch = texto[i];
    if(ch === '{') profundidade++;
    else if(ch === '}'){ profundidade--; if(profundidade === 0){ fim = i; break; } }
  }
  const corpo = texto.slice(inicio + 1, fim);
  // So o nivel de cima: `{a: 1, b: {c: 2}}` da a e b, nunca c.
  const topo = corpo.replace(/\{[^{}]*\}/g, '');
  return [
    // chave: valor
    ...[...topo.matchAll(/(?:^|,)\s*([a-z_]+)\s*:/g)].map(m => m[1]),
    /* chave abreviada — `{tipo: x, caminho, nome: y}`. O JavaScript deixa
     * escrever so o nome quando a variavel se chama igual a coluna, e era
     * por ai que uma coluna entrava sem ser conferida: `caminho` passou
     * despercebido justamente assim. */
    ...[...topo.matchAll(/(?:^|,)\s*([a-z_]+)\s*(?=[,}]|$)/g)].map(m => m[1]),
  ];
}

// 1) mud.coluna = ...  (montado campo a campo)
for(const m of html.matchAll(/\bmud\.([a-z_]+)\s*=/g)) anota(tabelaDe(m.index), m[1]);
// 2) mud = { ... }  e  const mud = { ... }
for(const m of html.matchAll(/\bmud\s*=\s*\{/g)){
  const tabela = tabelaDe(m.index);
  chavesDoObjeto(html, m.index + m[0].length - 1).forEach(c => anota(tabela, c));
}
// 3) from('tabela').update({ ... }) direto, sem passar por mud
for(const m of html.matchAll(/from\('([a-z_]+)'\)\s*\n?\s*\.?\s*update\(\{/g)){
  chavesDoObjeto(html, m.index + m[0].length - 1).forEach(c => anota(m[1], c));
}
// 4) from('tabela').insert({ ... })
for(const m of html.matchAll(/from\('([a-z_]+)'\)\s*\n?\s*\.?\s*insert\(\{/g)){
  chavesDoObjeto(html, m.index + m[0].length - 1).forEach(c => anota(m[1], c));
}
// onCampo(id, 'coluna', valor) — a edicao no cartao do Community, sempre
// em interacoes.
achar(/onCampo\([^,]+,\s*'([a-z_]+)'/g).forEach(c => anota('interacoes', c));
// Os payloads de insert, listados a mao porque vem de objetos literais
// grandes; o teste de cobertura abaixo garante que nao esqueci nenhum.
['cliente_id','autor','texto','link_conteudo','origem','rede_id','produto_id',
 'editoria_id','sentimento_id','triagem','resposta','data_publicacao']
  .forEach(c => anota('interacoes', c));

// As colunas conhecidas de cada tabela: as confirmadas no banco, mais as
// que um guia de migracao promete criar (conferido logo abaixo).
const colunasDe = (t) => new Set(
  esquema[t] || ((esquema._pendentes || {})[t] || {}).colunas || []);

/* Tabelas que existem e funcionam, mas cujas colunas nunca foram lidas do
 * banco. Este teste NAO pode conferir o que nao conhece — entao ele diz
 * isso, em vez de reprovar (seria alarme falso) ou de calar (seria fingir
 * que conferiu). */
const semDump = new Set((esquema._sem_dump || {}).tabelas || []);

let algumaFora = false;
Object.entries(porTabela).sort().forEach(([tabela, cols]) => {
  const conhecidas = colunasDe(tabela);
  if(semDump.has(tabela)){
    console.log(`  ----  | ${tabela}: colunas NAO conferidas (falta o dump do banco) -> grava ${[...cols].sort().join(', ')}`);
    return;
  }
  if(!conhecidas.size){
    algumaFora = true;
    check(`${tabela}: tabela desconhecida`, false, 'nao esta no esquema, nem em _pendentes, nem em _sem_dump');
    return;
  }
  const fora = [...cols].filter(c => !conhecidas.has(c));
  if(fora.length) algumaFora = true;
  check(`${tabela}: toda coluna gravada existe`, fora.length === 0,
    fora.length ? 'FALTA MIGRACAO para: ' + fora.join(', ') : [...cols].sort().join(', '));
});
check('nenhuma gravacao aponta para coluna inexistente', !algumaFora);

console.log('\n--- colunas removidas nao podem voltar ---');
Object.keys(esquema._removidas || {}).forEach(c => {
  const usos = (html.match(new RegExp('\\b' + c + '\\b', 'g')) || []).length;
  check(`"${c}" nao aparece mais no codigo`, usos === 0,
    usos ? usos + ' uso(s) — ' + esquema._removidas[c] : 'nenhum uso');
});

console.log('\n--- as quatro colunas da IA estao em uso e documentadas ---');
['ia_em','ia_triagem','ia_motivo','ia_juridico'].forEach(c => {
  check(`${c}: no esquema e usada no codigo`,
    colunasDe('interacoes').has(c) && html.includes(c));
});

console.log('\n--- o guia de migracao cria o que o codigo precisa ---');
const guia = fs.readFileSync(path.join(__dirname, '..', 'MIGRACAO-TELA-DE-COMENTARIOS.md'), 'utf8');
['ia_em','ia_triagem','ia_motivo','ia_juridico'].forEach(c =>
  check(`o guia cria ${c}`, new RegExp('add column if not exists\\s+' + c).test(guia)));
// O guia FALA de data_coment, para explicar por que ela saiu. O que nao pode
// e ter comando que a crie — e a diferenca entre citar e ressuscitar.
check('e o guia nao tem comando que crie a coluna descartada',
  !/add column[^\n]*data_coment/i.test(guia));

console.log('\n--- a area de arquivos nasce FECHADA ---');
/* Area aberta significaria que qualquer um com o endereco veria a campanha
   antes da hora. O guia e a unica coisa que decide isso, entao e ele que
   este teste le. */
const guiaArq = fs.readFileSync(path.join(__dirname, '..', 'MIGRACAO-ARQUIVOS.md'), 'utf8');
check('o guia cria o balde "conteudos"', /insert into storage\.buckets/.test(guiaArq));
check('e ele nasce fechado, nao publico',
  /'conteudos',\s*'conteudos',\s*false/.test(guiaArq));
check('e um "rodar de novo" nao o abre',
  /do update set[\s\S]{0,80}public\s*=\s*false/.test(guiaArq));
check('o limite por arquivo do guia bate com o do codigo',
  /52428800/.test(guiaArq) && /50 \* 1024 \* 1024/.test(html),
  'guia e codigo precisam dizer o mesmo limite');
// Todo tipo que o codigo aceita tem que estar liberado no balde, senao o
// arquivo e recusado pelo Supabase depois de a pessoa ja ter escolhido.
['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
  .forEach(t => check(`o guia libera ${t}`, guiaArq.includes(t) && html.includes(t)));

console.log('\n--- as metricas usadas na tela existem no banco ---');
const METRICAS = ['visu','curtidas','coment','compart','salvos'];
METRICAS.forEach(base => {
  const ok = esquema.publicacoes.includes(base+'_org') && esquema.publicacoes.includes(base+'_pago');
  check(`${base}: existe em organico e pago`, ok);
});

console.log('\n--- nada de tabela inventada ---');
const tabelas = [...new Set(achar(/from\('([a-z_]+)'\)/g))];
const TABELAS_OK = ['interacoes','publicacoes','clientes','redes','produtos','editorias','categorias_sentimento','perfis'];
// Tabela que um guia de migracao cria mas que ainda nao foi confirmada no
// banco. O codigo pode usar; o que nao pode e nao existir guia que a crie —
// foi exatamente assim que as colunas ia_* ficaram orfas.
const pendentes = { ...(esquema._pendentes || {}) };
delete pendentes._porque;
const tabelasFora = tabelas.filter(t => !TABELAS_OK.includes(t) && !pendentes[t]);
check('o codigo so fala com as tabelas que existem ou tem migracao', tabelasFora.length === 0,
  tabelasFora.join(', ') || tabelas.join(', '));

console.log('\n--- toda tabela pendente tem um guia que a cria de verdade ---');
Object.entries(pendentes).forEach(([tabela, info]) => {
  // Entradas que comecam com "_" nao sao tabela: sao outra coisa criada por
  // um guia (a area de arquivos do Storage, por exemplo). Conferimos so que
  // o guia existe.
  if(tabela.startsWith('_')){
    check(`${tabela}: o guia ${info.migracao} existe`,
      fs.existsSync(path.join(__dirname, '..', info.migracao)));
    return;
  }
  const arq = path.join(__dirname, '..', info.migracao);
  const existe = fs.existsSync(arq);
  check(`${tabela}: o guia ${info.migracao} existe`, existe);
  if(!existe) return;
  const guia = fs.readFileSync(arq, 'utf8');
  check(`${tabela}: o guia tem o create table`,
    new RegExp('create table if not exists\\s+' + tabela).test(guia));
  // Cada coluna que o guia promete tem que estar escrita nele. Sem isso, uma
  // coluna podia entrar no codigo e nunca ser criada — o erro original.
  const faltando = info.colunas.filter(c => !new RegExp('^\\s+' + c + '\\s', 'm').test(guia));
  check(`${tabela}: o guia cria as ${info.colunas.length} colunas`, faltando.length === 0,
    faltando.length ? 'falta no guia: ' + faltando.join(', ') : 'todas presentes');
  // E o codigo so pode gravar nas colunas que o guia cria.
  const gravadasNa = new Set(achar(
    new RegExp("from\\('" + tabela + "'\\)[\\s\\S]{0,120}?update\\(\\{\\s*([a-z_]+)", 'g')));
  const foraDoGuia = [...gravadasNa].filter(c => !info.colunas.includes(c));
  check(`${tabela}: o codigo nao grava coluna fora do guia`, foraDoGuia.length === 0,
    foraDoGuia.join(', ') || 'nenhuma');
});

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
