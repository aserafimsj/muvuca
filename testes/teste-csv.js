// Testa a exportacao CSV sem navegador. O caso que importa e o comentario
// com ponto e virgula, aspas e quebra de linha DENTRO do texto: se o arquivo
// nao aguentar isso, a planilha abre com as colunas embaralhadas e ninguem
// percebe, porque ela abre — so abre errado.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function recortar(nome, re){
  const m = html.match(re);
  if(!m){ console.error(`FALHA: nao achei ${nome} no index.html`); process.exit(2); }
  return m[0];
}
const fonte = [
  recortar('IA_TRIAGEM',   /const IA_TRIAGEM = \{[\s\S]*?\n\};/),
  recortar('SITUACAO_CSV', /const SITUACAO_CSV = \{[\s\S]*?\n\};/),
  recortar('paraCSV',      /function paraCSV\(itens, cfg\)\{[\s\S]*?\n\}/),
].join('\n');
const { paraCSV } = eval('(function(){' + fonte + '\nreturn {paraCSV};})()');

const r = [];
const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };

const CFG = {
  sentimentos:[{id:1,nome:'Positivo'},{id:4,nome:'Dúvida'}],
  redes:[{id:1,nome:'Instagram'}],
  produtos:[{id:2,nome:'IPCA+'}],
  editorias:[{id:3,nome:'Educativo'}],
};

// O comentario malvado: tem ponto e virgula (o separador), aspas e duas
// quebras de linha dentro do texto.
const MALVADO = {
  id:1, triagem:'Pendente', data_publicacao:'2026-09-15', rede_id:1, origem:'Feed',
  link_conteudo:'https://insta/p/abc', autor:'valdirene',
  texto:'Oi; tenho uma "dúvida":\nquanto rende?\nObrigada',
  sentimento_id:4, produto_id:2, editoria_id:3, resposta:'Oi! Depende do título.',
  ia_triagem:'responder', ia_motivo:'duvida de iniciante', ia_juridico:false,
  ia_em:'2026-09-20T23:00:00Z',
};
const NUNCA_VISTO = {
  id:2, triagem:'Lixeira', data_publicacao:null, rede_id:null, origem:null,
  link_conteudo:null, autor:null, texto:'sem nada', sentimento_id:null,
  produto_id:null, editoria_id:null, resposta:null,
  ia_triagem:null, ia_motivo:null, ia_juridico:null, ia_em:null,
};

const csv = paraCSV([MALVADO, NUNCA_VISTO], CFG);

console.log('--- o basico do arquivo ---');
check('comeca com a marca de UTF-8 (senao "Dúvida" vira "DÃºvida" no Excel)',
  csv.charCodeAt(0) === 0xFEFF);
check('separa as colunas por ponto e virgula (padrao do Excel em portugues)',
  csv.split('\r\n')[0].includes(';') && !csv.split('\r\n')[0].includes(','));
check('quebra as linhas com CRLF', csv.includes('\r\n'));
const cabecalho = csv.slice(1).split('\r\n')[0];
check('tem as 15 colunas', cabecalho.split(';').length === 15, cabecalho.split(';').length+'');
check('a primeira coluna e a situacao', cabecalho.startsWith('situacao'));

console.log('\n--- o comentario malvado nao quebra o arquivo ---');
// Leitor de CSV de verdade: respeita aspas, e so trata ; e quebra de linha
// como separador quando estao FORA das aspas.
function lerCSV(txt){
  const linhas = []; let campo = '', linha = [], dentro = false;
  const s = txt.replace(/^﻿/, '');
  for(let k = 0; k < s.length; k++){
    const c = s[k];
    if(dentro){
      if(c === '"' && s[k+1] === '"'){ campo += '"'; k++; }
      else if(c === '"'){ dentro = false; }
      else campo += c;
    } else if(c === '"'){ dentro = true; }
    else if(c === ';'){ linha.push(campo); campo = ''; }
    else if(c === '\r' && s[k+1] === '\n'){ linha.push(campo); linhas.push(linha); linha = []; campo = ''; k++; }
    else campo += c;
  }
  if(campo !== '' || linha.length){ linha.push(campo); linhas.push(linha); }
  return linhas;
}
const lido = lerCSV(csv);
check('o arquivo tem 3 linhas: cabecalho + 2 comentarios', lido.length === 3, lido.length+'');
check('toda linha tem 15 colunas', lido.every(l => l.length === 15),
  lido.map(l=>l.length).join(','));
check('o texto volta inteiro, com ; aspas e quebras',
  lido[1][6] === MALVADO.texto, JSON.stringify(lido[1][6]).slice(0,45));
check('o ponto e virgula de dentro do texto nao virou coluna nova',
  lido[1][6].includes('Oi; tenho'));
check('as aspas de dentro voltaram simples, nao dobradas',
  lido[1][6].includes('"dúvida"'));

console.log('\n--- os nomes sao resolvidos, nao os numeros ---');
check('rede vira "Instagram"',   lido[1][2] === 'Instagram', lido[1][2]);
check('sentimento vira "Dúvida"', lido[1][7] === 'Dúvida', lido[1][7]);
check('produto vira "IPCA+"',     lido[1][8] === 'IPCA+', lido[1][8]);
check('editoria vira "Educativo"',lido[1][9] === 'Educativo', lido[1][9]);
check('a situacao sai legivel, nao "Pendente" cru', lido[1][0] === 'Na fila', lido[1][0]);
check('"Ignorar" nao aparece cru no arquivo', !csv.includes('Ignorar'));
check('recomendacao da IA sai por extenso', lido[1][11] === 'IA: responder', lido[1][11]);

console.log('\n--- o que a IA nunca viu ---');
check('juridico fica VAZIO quando a IA nunca olhou', lido[2][13] === '', JSON.stringify(lido[2][13]));
check('e sai "nao" quando ela olhou e nao era sensivel', lido[1][13] === 'não', lido[1][13]);
check('campo nulo vira vazio, nao "null"', lido[2][5] === '' && !csv.includes('null'));
check('a situacao da lixeira sai legivel', lido[2][0] === 'Na lixeira', lido[2][0]);

console.log('\n--- lista vazia ---');
const soCabecalho = paraCSV([], CFG);
check('sem comentarios, sai so o cabecalho', lerCSV(soCabecalho).length === 1);

console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
process.exit(r.every(Boolean) ? 0 : 1);
