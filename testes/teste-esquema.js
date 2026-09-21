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

console.log('--- colunas que o codigo grava em interacoes ---');
const gravadas = new Set([
  // mud.coluna = ... (a classificacao pela IA)
  ...achar(/\bmud\.([a-z_]+)\s*=/g),
  // onCampo(id, 'coluna', valor) — edicao no cartao
  ...achar(/onCampo\([^,]+,\s*'([a-z_]+)'/g),
  // update({ coluna: ... }) direto
  ...achar(/\bmud = \{\s*([a-z_]+):/g),
]);
// Os payloads de insert, listados a mao porque vem de objetos literais
// grandes; o teste de cobertura abaixo garante que nao esqueci nenhum.
['cliente_id','autor','texto','link_conteudo','origem','rede_id','produto_id',
 'editoria_id','sentimento_id','triagem','resposta','data_publicacao']
  .forEach(c => gravadas.add(c));

const conhecidas = new Set(esquema.interacoes);
const fora = [...gravadas].filter(c => !conhecidas.has(c));

console.log('   grava: ' + [...gravadas].sort().join(', '));
check('toda coluna gravada existe no banco confirmado', fora.length === 0,
  fora.length ? 'FALTA MIGRACAO para: ' + fora.join(', ') : 'nenhuma fora da lista');

console.log('\n--- colunas removidas nao podem voltar ---');
Object.keys(esquema._removidas || {}).forEach(c => {
  const usos = (html.match(new RegExp('\\b' + c + '\\b', 'g')) || []).length;
  check(`"${c}" nao aparece mais no codigo`, usos === 0,
    usos ? usos + ' uso(s) — ' + esquema._removidas[c] : 'nenhum uso');
});

console.log('\n--- as quatro colunas da IA estao em uso e documentadas ---');
['ia_em','ia_triagem','ia_motivo','ia_juridico'].forEach(c => {
  check(`${c}: no esquema e usada no codigo`,
    conhecidas.has(c) && html.includes(c));
});

console.log('\n--- o guia de migracao cria o que o codigo precisa ---');
const guia = fs.readFileSync(path.join(__dirname, '..', 'MIGRACAO-TELA-DE-COMENTARIOS.md'), 'utf8');
['ia_em','ia_triagem','ia_motivo','ia_juridico'].forEach(c =>
  check(`o guia cria ${c}`, new RegExp('add column if not exists\\s+' + c).test(guia)));
// O guia FALA de data_coment, para explicar por que ela saiu. O que nao pode
// e ter comando que a crie — e a diferenca entre citar e ressuscitar.
check('e o guia nao tem comando que crie a coluna descartada',
  !/add column[^\n]*data_coment/i.test(guia));

console.log('\n--- as metricas usadas na tela existem no banco ---');
const METRICAS = ['visu','curtidas','coment','compart','salvos'];
METRICAS.forEach(base => {
  const ok = esquema.publicacoes.includes(base+'_org') && esquema.publicacoes.includes(base+'_pago');
  check(`${base}: existe em organico e pago`, ok);
});

console.log('\n--- nada de tabela inventada ---');
const tabelas = [...new Set(achar(/from\('([a-z_]+)'\)/g))];
const TABELAS_OK = ['interacoes','publicacoes','clientes','redes','produtos','editorias','categorias_sentimento','perfis'];
const tabelasFora = tabelas.filter(t => !TABELAS_OK.includes(t));
check('o codigo so fala com as tabelas que existem', tabelasFora.length === 0,
  tabelasFora.join(', ') || tabelas.join(', '));

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
