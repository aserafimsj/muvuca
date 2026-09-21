const { chromium } = require('playwright');
const path = require('path');
require('./monta-conteudos.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1150, height:1400} });
  const erros = [];
  // Os posts do Instagram nao carregam aqui: esta maquina nao tem internet.
  // Falha de REDE nao e defeito do MUVUCA, entao nao conta como erro.
  const deRede = t => /net::|Failed to load resource|ERR_|X-Frame|refused to connect/i.test(t);
  page.on('console', m => { if(m.type()==='error' && !deRede(m.text())) erros.push(m.text()); });
  page.on('pageerror', e => { if(!deRede(e.message)) erros.push('PAGEERROR: ' + e.message); });

  await page.goto('file://' + path.join(__dirname, 'conteudos.html'));
  await page.waitForSelector('.mural', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const cartoes = () => page.locator('.post').count();
  const cartaoDoLink = t => page.locator('.post').filter({ has: page.locator(`a[href*="${t}"]`) }).first();

  console.log('\n--- o mural ---');
  check('mostra 12 por pagina', await cartoes() === 12, await cartoes()+'');
  check('o topo diz quantas publicacoes existem',
    (await page.locator('.head p').textContent()).includes('14'));
  check('oferece carregar o resto', await page.getByRole('button', {name:/Mostrar mais/}).count() === 1);
  await page.getByRole('button', {name:/Mostrar mais/}).click();
  await page.waitForTimeout(250);
  check('carregar mostra as 14', await cartoes() === 14, await cartoes()+'');
  check('e o botao some quando acabou', await page.getByRole('button', {name:/Mostrar mais/}).count() === 0);

  console.log('\n--- contagem de comentarios por post ---');
  // O post ABC123 tem 3 comentarios vivos, cada um com o link escrito de um
  // jeito diferente, MAIS um na lixeira que nao pode contar.
  const p1 = cartaoDoLink('ABC123');
  check('conta os 3, apesar dos links escritos diferente',
    (await p1.locator('.ppe span').textContent()).startsWith('3 '),
    (await p1.locator('.ppe span').textContent()).trim());
  check('e NAO conta o que esta na lixeira',
    !(await p1.locator('.ppe span').textContent()).startsWith('4 '));
  const p2 = cartaoDoLink('DEF456');
  check('o outro post conta o seu 1', (await p2.locator('.ppe span').textContent()).startsWith('1 '),
    (await p2.locator('.ppe span').textContent()).trim());
  const p3 = cartaoDoLink('exemplo.com');
  check('post sem comentario mostra zero', (await p3.locator('.ppe span').textContent()).startsWith('0 '),
    (await p3.locator('.ppe span').textContent()).trim());

  console.log('\n--- comentarios orfaos ---');
  check('avisa que ha comentario apontando para post nao importado',
    await page.getByText(/apontam para um post que não está/).count() === 1);
  // Sao 1: o que aponta para NAOEXISTE. O sem link nenhum nao conta como orfao.
  check('e conta 1, nao o que esta sem link',
    (await page.locator('.aviso').textContent()).trim().startsWith('1 '),
    (await page.locator('.aviso').textContent()).trim().slice(0,30));

  console.log('\n--- mostrar o post dentro da pagina ---');
  check('post do Instagram vira quadro incorporado', await p1.locator('iframe.pembed').count() === 1);
  check('e aponta para o endereco de incorporacao',
    (await p1.locator('iframe.pembed').getAttribute('src')).endsWith('/embed'));
  check('carrega so quando aparece na tela',
    await p1.locator('iframe.pembed').getAttribute('loading') === 'lazy');
  check('link que nao da para mostrar explica em vez de ficar em branco',
    await p3.locator('.psemembed').count() === 1);
  check('e mesmo assim oferece abrir', await p3.locator('a[href]').count() === 1);

  console.log('\n--- numeros do post ---');
  // Post 1: as duas colunas preenchidas. Curtidas = 100 + 40.
  const nums1 = await p1.locator('.pnums span').allTextContents();
  check('soma organico + pago', nums1.some(t => t.includes('140') && t.includes('Curtidas')),
    nums1.join(' | '));
  check('visualizacoes tambem somam', nums1.some(t => t.includes('1.500')), nums1.join(' | '));
  // Post 2: planilha com uma coluna so. Curtidas = 140, pago vazio.
  const nums2 = await p2.locator('.pnums span').allTextContents();
  check('planilha com uma coluna so nao perde o valor',
    nums2.some(t => t.includes('140') && t.includes('Curtidas')), nums2.join(' | '));
  check('metrica sem dado nenhum NAO aparece como zero',
    !nums2.some(t => t.includes('Salvamentos')), nums2.join(' | '));
  check('post sem metrica nenhuma nao mostra numero',
    await p3.locator('.pnums span').count() === 0);

  console.log('\n--- filtros ---');
  await page.locator('.filters select').selectOption({label:'Facebook'});
  await page.waitForTimeout(250);
  check('filtrar por rede deixa so o do Facebook', await cartoes() === 1, await cartoes()+'');
  await page.locator('.filters select').selectOption({label:'Rede: todas'});
  await page.waitForTimeout(250);
  await page.locator('.filters input').fill('Carrossel');
  await page.waitForTimeout(300);
  check('buscar por formato acha', await cartoes() === 1, await cartoes()+'');
  await page.locator('.filters input').fill('bitcoin');
  await page.waitForTimeout(300);
  check('busca sem resultado explica que foi o filtro',
    await page.getByText(/corresponde ao que você filtrou/).count() === 1);
  await page.locator('.filters input').fill('');
  await page.waitForTimeout(300);

  // Cartao sem post incorporado nao pode esticar ate a altura do vizinho.
  const alturas = await page.locator('.post').evaluateAll(
    ns => ns.slice(0,3).map(n => Math.round(n.getBoundingClientRect().height)));
  check('cartao sem post incorporado e mais baixo que os outros',
    alturas[2] < alturas[0], alturas.join(' / '));

  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await page.screenshot({ path: path.join(__dirname,'conteudos.png'), fullPage: false });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
