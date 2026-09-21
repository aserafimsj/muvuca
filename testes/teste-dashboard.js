// Testa as contas do dashboard sem navegador: periodos, agrupamento e serie
// diaria. Numero errado em relatorio nao aparece como erro — aparece como um
// numero plausivel e errado. Por isso estas contas sao funcao pura.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ini = html.indexOf('const PERIODOS = [');
const fimIdx = html.indexOf('\n}', html.indexOf('function serieDiaria'));
if(ini < 0 || fimIdx < 0){ console.error('FALHA: nao achei as funcoes do dashboard no index.html'); process.exit(2); }
const fonte = html.slice(ini, fimIdx + 2);

const M = eval('(function(){' + fonte + `
return {resolvePeriodo, noPeriodo, dataDoComentario, contarPor, serieDiaria, inicioDoDia, fimDoDia, dataLocal, chaveDia};})()`);

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
const DIA = 86400000;

console.log('--- que data vale para o comentario ---');
check('usa a data informada',
  M.chaveDia(M.dataDoComentario({data_coment:'2026-09-15', ia_em:'2026-01-01T00:00:00Z'})) === '2026-09-15');
check('sem data informada, usa a da analise',
  M.dataDoComentario({data_coment:null, ia_em:'2026-09-10T12:00:00Z'}) !== null);
check('sem nenhuma das duas, nao tem data',
  M.dataDoComentario({data_coment:null, ia_em:null}) === null);
check('data informada ganha da data de analise',
  M.chaveDia(M.dataDoComentario({data_coment:'2026-03-02', ia_em:'2026-09-10T12:00:00Z'})) === '2026-03-02');

console.log('\n--- recortes de periodo ---');
const p7 = M.resolvePeriodo('7d');
check('"7 dias" comeca as 00:00', p7.de.getHours() === 0 && p7.de.getMinutes() === 0);
check('"7 dias" termina as 23:59', p7.ate.getHours() === 23 && p7.ate.getMinutes() === 59);
check('"7 dias" cobre 7 dias', Math.round((p7.ate - p7.de)/DIA) === 7, Math.round((p7.ate-p7.de)/DIA)+'');
check('"28 dias" cobre 28', Math.round((M.resolvePeriodo('28d').ate - M.resolvePeriodo('28d').de)/DIA) === 28);
check('"90 dias" cobre 90', Math.round((M.resolvePeriodo('90d').ate - M.resolvePeriodo('90d').de)/DIA) === 90);
const ont = M.resolvePeriodo('ontem');
check('"ontem" e um dia so', Math.round((ont.ate - ont.de)/DIA) === 1);
check('"ontem" e antes de hoje', ont.ate < M.inicioDoDia(new Date()));
const sem = M.resolvePeriodo('semana');
check('"esta semana" comeca numa segunda', sem.de.getDay() === 1, 'dia '+sem.de.getDay());
const semP = M.resolvePeriodo('semana_passada');
check('"semana passada" comeca numa segunda', semP.de.getDay() === 1);
check('"semana passada" tem 7 dias', Math.round((semP.ate - semP.de)/DIA) === 7);
check('"semana passada" termina antes desta', semP.ate < sem.de);
const mes = M.resolvePeriodo('mes');
check('"este mes" comeca no dia 1', mes.de.getDate() === 1);
const mesP = M.resolvePeriodo('mes_passado');
check('"mes passado" comeca no dia 1', mesP.de.getDate() === 1);
check('"mes passado" termina antes deste', mesP.ate < mes.de);
check('"este ano" comeca em 1 de janeiro',
  M.resolvePeriodo('ano').de.getMonth() === 0 && M.resolvePeriodo('ano').de.getDate() === 1);
const cus = M.resolvePeriodo('custom', '2026-09-01', '2026-09-30');
check('datas escolhidas a mao viram o intervalo certo',
  M.chaveDia(cus.de) === '2026-09-01' && M.chaveDia(cus.ate) === '2026-09-30');
check('"todo o periodo" nao limita', M.resolvePeriodo('total').de === null);

console.log('\n--- quem entra no periodo ---');
const dentro = {data_coment:'2026-09-15'}, fora = {data_coment:'2020-01-01'}, semdata = {data_coment:null, ia_em:null};
const jan = M.resolvePeriodo('custom','2026-09-01','2026-09-30');
check('dentro do intervalo entra',  M.noPeriodo(dentro, 'custom', jan.de, jan.ate) === true);
check('fora do intervalo nao entra', M.noPeriodo(fora, 'custom', jan.de, jan.ate) === false);
check('SEM DATA nao entra em recorte', M.noPeriodo(semdata, 'custom', jan.de, jan.ate) === false);
check('SEM DATA entra em "todo o periodo"', M.noPeriodo(semdata, 'total', null, null) === true);
check('no primeiro dia do intervalo entra',
  M.noPeriodo({data_coment:'2026-09-01'}, 'custom', jan.de, jan.ate) === true);
check('no ultimo dia do intervalo entra',
  M.noPeriodo({data_coment:'2026-09-30'}, 'custom', jan.de, jan.ate) === true);

console.log('\n--- agrupamento ---');
const itens = [
  {s:'Negativo'}, {s:'Negativo'}, {s:'Negativo'}, {s:'Dúvida'}, {s:'Dúvida'}, {s:'Positivo'}, {s:null},
];
const porS = M.contarPor(itens, i => i.s, 'Sem sentimento');
check('conta certo', porS[0].n === 3 && porS[0].nome === 'Negativo');
check('ordena do maior para o menor', porS.map(d=>d.n).join(',') === '3,2,1,1', porS.map(d=>d.n).join(','));
check('o vazio vira balde proprio', porS.some(d => d.nome === 'Sem sentimento' && d.n === 1));
check('a soma fecha com o total',
  porS.reduce((a,d)=>a+d.n,0) === itens.length, porS.reduce((a,d)=>a+d.n,0)+' de '+itens.length);
const porSemBalde = M.contarPor(itens, i => i.s);
check('sem balde, o vazio some da conta', porSemBalde.reduce((a,d)=>a+d.n,0) === 6);
check('empate desempata por nome',
  M.contarPor([{s:'Zebra'},{s:'Abacaxi'}], i=>i.s).map(d=>d.nome).join(',') === 'Abacaxi,Zebra');
check('lista vazia nao quebra', M.contarPor([], i=>i.s).length === 0);

console.log('\n--- serie diaria ---');
const serie = M.serieDiaria([
  {data_coment:'2026-09-01'}, {data_coment:'2026-09-01'},
  {data_coment:'2026-09-04'},   // dias 2 e 3 sem nada
]);
check('vai do primeiro ao ultimo dia', serie.length === 4, serie.length+' dias');
check('primeiro dia com 2', serie[0].dia === '2026-09-01' && serie[0].n === 2);
// O ponto importante: dia parado tem que valer zero, nao sumir. Se sumisse, um
// fim de semana sem movimento viraria uma linha reta enganosa.
check('dia sem comentario vale zero', serie[1].n === 0 && serie[2].n === 0);
check('ultimo dia com 1', serie[3].dia === '2026-09-04' && serie[3].n === 1);
check('a soma bate com a entrada', serie.reduce((a,p)=>a+p.n,0) === 3);
check('sem datas, serie vazia', M.serieDiaria([{data_coment:null, ia_em:null}]).length === 0);
check('um dia so nao quebra', M.serieDiaria([{data_coment:'2026-09-01'}]).length === 1);

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
