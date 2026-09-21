const { chromium } = require('playwright');
const path = require('path');

// Remonta sempre: rodar contra um manha.html velho da falso alarme nos dois
// sentidos — acusa defeito ja corrigido, ou deixa passar um que acabou de
// entrar.
require('./monta-manha.js');

/* Os dados estao em monta-manha.js. Do que esta la sai o que se espera aqui,
   e nao de chute:
     na fila (pendente): 1, 2, 3, 4, 7  -> 5
       comentarios (feed): 1, 4, 7      -> 3
       DMs:                2, 3         -> 2
       escalados:          2, 4         -> 2
     fora da fila: 5 (respondido), 6 (ignorado)
   O item 6 esta escalado MAS ignorado: se o aviso do topo contasse tudo, o
   numero de escalados daria 3 e nunca voltaria a zero. */

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:1150, height:1600} });
  const erros = [];
  page.on('console', m => { if(m.type()==='error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(__dirname, 'manha.html'));
  await page.waitForSelector('.row', { timeout: 15000 });

  const r = [];
  const check = (nome, ok, extra='') => { r.push(!!ok); console.log((ok?'  OK  ':' FALHA')+` | ${nome}${extra?' -> '+extra:''}`); };
  const linhas = () => page.locator('.row').count();
  const chip = n => page.locator('.chip', { hasText: n }).first();
  const clicar = async loc => { await loc.click(); await page.waitForTimeout(250); };

  console.log('\n--- o aviso do topo ---');
  const titulo = (await page.locator('h1').textContent()).trim();
  check('diz "Novidades desde ontem"', /^Novidades desde ontem/.test(titulo), titulo);
  check('conta 3 comentarios', /3 comentários/.test(titulo), titulo);
  check('conta 2 DMs',         /2 DMs/.test(titulo), titulo);
  check('conta 2 para escalar',/2 para escalar/.test(titulo), titulo);
  check('o subtitulo diz quem responde', await page.getByText(/quem responde é você/).count() === 1);

  const cartao = n => page.locator('.card', {hasText:n}).first();
  check('cartao "Na fila" = 5',      (await cartao('Na fila').textContent()).includes('5'));
  check('cartao "Comentários" = 3',  (await cartao('Comentários').textContent()).includes('3'));
  check('cartao "DMs" = 2',          (await cartao('DMs').textContent()).includes('2'));
  check('cartao "Para escalar" = 2', (await cartao('Para escalar').textContent()).includes('2'));
  check('abre na fila, com 5 itens', await linhas() === 5, String(await linhas()));

  console.log('\n--- ESCALAR: motivo em destaque, resposta NENHUMA ---');
  // O item 2 (tema politico) e o segundo da lista — a ordem vem do "banco".
  const escalados = page.locator('.row').filter({has: page.locator('.escalar')});
  check('dois cartoes escalados na fila', await escalados.count() === 2, String(await escalados.count()));

  const esc = escalados.first();
  check('o bloco diz ESCALAR', (await esc.locator('.escalar .titulo').textContent()).trim() === 'ESCALAR');
  check('o motivo aparece em destaque',
    (await esc.locator('.escalar .motivo').textContent()).includes('tema político'),
    await esc.locator('.escalar .motivo').textContent());
  // A checagem mais importante do arquivo inteiro.
  check('NAO existe caixa de resposta no cartao escalado',
    await esc.locator('textarea').count() === 0, String(await esc.locator('textarea').count()));
  check('NAO existe botao Copiar no cartao escalado',
    await esc.getByRole('button', {name:'Copiar'}).count() === 0);
  check('e explica que a ausencia e de proposito',
    await esc.getByText(/de propósito/).count() === 1);

  const esc2 = escalados.nth(1);
  check('o motivo de linguagem proibida cita a palavra barrada',
    (await esc2.locator('.escalar .motivo').textContent()).includes('linguagem proibida'),
    await esc2.locator('.escalar .motivo').textContent());
  check('e tambem nao mostra resposta', await esc2.locator('textarea').count() === 0);

  // Em toda a tela, nenhuma caixa de resposta pode conviver com um bloco
  // vermelho no mesmo cartao. Esta e a regra escrita como invariante.
  const convivem = await page.evaluate(() =>
    [...document.querySelectorAll('.row')]
      .filter(l => l.querySelector('.escalar') && l.querySelector('textarea')).length);
  check('em nenhum cartao o vermelho convive com resposta', convivem === 0, String(convivem));

  console.log('\n--- cartao normal: ler, ajustar, copiar ---');
  const normal = page.locator('.row').filter({hasNot: page.locator('.escalar')}).first();
  check('tem caixa de resposta', await normal.locator('textarea').count() === 1);
  check('ja vem com a sugestao dentro',
    (await normal.locator('textarea').inputValue()).includes('CPF ativo'),
    await normal.locator('textarea').inputValue());
  check('mostra a etiqueta da IA', await normal.locator('.pill', {hasText:'IA: responder'}).count() === 1);
  check('mostra o motivo', await normal.getByText('· duvida de iniciante').count() === 1);
  check('mostra a origem', (await normal.locator('.tag').textContent()).trim() === 'Feed');

  const link = normal.locator('a', {hasText:'abrir no Instagram'});
  check('oferece abrir no Instagram', await link.count() === 1);
  check('e abre em aba nova', await link.getAttribute('target') === '_blank');
  check('com rel seguro', (await link.getAttribute('rel') || '').includes('noopener'));

  await clicar(normal.getByRole('button', {name:'Copiar'}));
  check('copiar poe o texto na area de transferencia',
    (await page.evaluate(() => window.__copiado.length)) === 1);
  check('e o texto copiado e a sugestao',
    (await page.evaluate(() => window.__copiado[0])).includes('CPF ativo'));
  check('copiar sem editar NAO grava nada',
    (await page.evaluate(() => window.__gravacoes.length)) === 0,
    await page.evaluate(() => JSON.stringify(window.__gravacoes)));
  check('o botao confirma a copia', (await normal.getByRole('button').first().textContent()).includes('Copiado'));

  console.log('\n--- o texto ajustado nao se perde ---');
  await normal.locator('textarea').fill('Oi, @valdirene! Versão ajustada por mim.');
  await page.waitForTimeout(200);
  check('digitar NAO grava a cada tecla',
    (await page.evaluate(() => window.__gravacoes.length)) === 0);
  check('a tela avisa que o ajuste e salvo ao copiar',
    await normal.getByText(/salvo ao copiar/).count() === 1);
  await clicar(normal.getByRole('button', {name:'Copiar'}));
  const grav = await page.evaluate(() => window.__gravacoes);
  check('copiar depois de editar grava o texto ajustado',
    grav.length === 1 && grav[0].reply === 'Oi, @valdirene! Versão ajustada por mim.',
    JSON.stringify(grav));
  check('e grava na tabela certa', grav[0] && grav[0].tabela === 'manha_items');
  check('e o texto copiado e o ajustado',
    (await page.evaluate(() => window.__copiado[window.__copiado.length-1])).includes('ajustada por mim'));

  console.log('\n--- sair da fila ---');
  await clicar(page.locator('.row').first().getByRole('button', {name:/Marcar como respondido/}));
  check('o item sai da fila', await linhas() === 4, String(await linhas()));
  const g2 = await page.evaluate(() => window.__gravacoes[window.__gravacoes.length-1]);
  check('e grava status=respondido', g2.status === 'respondido', JSON.stringify(g2));
  const t2 = (await page.locator('h1').textContent()).trim();
  check('o aviso do topo cai junto', /2 comentários/.test(t2), t2);

  await clicar(page.locator('.row').first().getByRole('button', {name:'Ignorar'}));
  check('ignorar tambem tira da fila', await linhas() === 3, String(await linhas()));
  const g3 = await page.evaluate(() => window.__gravacoes[window.__gravacoes.length-1]);
  check('e grava status=ignorado', g3.status === 'ignorado', JSON.stringify(g3));
  check('o numero de escalados cai',
    /1 para escalar/.test(await page.locator('h1').textContent()),
    await page.locator('h1').textContent());

  console.log('\n--- filtros ---');
  await clicar(chip('Respondidos'));
  check('Respondidos mostra o que saiu da fila', await linhas() === 2, String(await linhas()));
  check('la nao ha "Marcar como respondido"',
    await page.getByRole('button', {name:/Marcar como respondido/}).count() === 0);
  check('e oferece voltar para a fila',
    await page.getByRole('button', {name:/Voltar para a fila/}).count() === 2);

  await clicar(chip('Na fila'));
  check('volta para a fila com 3', await linhas() === 3);

  await clicar(chip('DMs'));
  check('filtrar DMs deixa 1', await linhas() === 1, String(await linhas()));
  check('e e mesmo uma DM', (await page.locator('.row .tag').first().textContent()).trim() === 'DM');
  await clicar(chip('Tudo'));

  await clicar(chip('Só para escalar'));
  check('so escalados deixa 1', await linhas() === 1, String(await linhas()));
  check('e ele tem o bloco vermelho', await page.locator('.escalar').count() === 1);
  check('e nenhuma resposta na tela', await page.locator('.row textarea').count() === 0);

  // Na fila sobraram: 3 (DM, normal), 4 (comentario, escalado), 7 (comentario).
  // "so escalados" + "DMs" nao tem ninguem — o unico escalado da fila e
  // comentario. Combinar com "Comentarios" daria 1, e nao serviria de teste.
  await clicar(chip('DMs'));
  check('combinar filtros sem resultado esvazia', await linhas() === 0, String(await linhas()));
  check('e explica que foi o filtro, nao a ausencia de novidade',
    await page.getByText(/Nenhuma novidade com esses filtros/).count() === 1);
  check('e nao diz "Nada novo hoje" aqui',
    await page.getByText('Nada novo hoje 💙').count() === 0);
  await clicar(page.getByRole('button', {name:'limpar', exact:true}));
  check('limpar devolve a fila', await linhas() === 3, String(await linhas()));

  console.log('\n--- estado vazio e estado de erro ---');
  await clicar(page.locator('#b-vazio'));
  await page.waitForTimeout(300);
  check('sem novidade nenhuma, diz "Nada novo hoje"',
    await page.getByText('Nada novo hoje 💙').count() >= 1);
  check('e o titulo tambem',
    /Nada novo hoje/.test(await page.locator('h1').textContent()));
  check('nao mostra cartoes de numero vazios', await page.locator('.cards').count() === 0);
  check('nem filtros para filtrar nada', await page.locator('.chips').count() === 0);

  await clicar(page.locator('#b-erro'));
  await page.waitForTimeout(300);
  check('tabela faltando vira aviso em portugues',
    await page.getByText(/MIGRACAO-MANHA\.md/).count() === 1);
  check('e nao finge que "nao ha novidade"',
    await page.getByText('Nada novo hoje 💙').count() === 0);

  await clicar(page.locator('#b-cheio'));
  await page.waitForTimeout(300);

  console.log('\n--- celular ---');
  await page.setViewportSize({width:375, height:900});
  await page.waitForTimeout(400);
  const larg = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    tela: window.innerWidth,
  }));
  check('nao rola para o lado no celular', larg.doc <= larg.tela + 1, `${larg.doc} > ${larg.tela}`);
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('.row .btn, .chip')]
      .filter(b => b.getBoundingClientRect().height < 34).length);
  check('nenhum botao menor que o dedo', pequenos === 0, String(pequenos));
  await page.screenshot({ path: path.join(__dirname,'celular-manha.png'), fullPage: true });

  await page.setViewportSize({width:1150, height:1600});
  await page.waitForTimeout(300);
  check('nenhum erro de execucao no console', erros.length === 0, erros.slice(0,2).join(' | '));

  await page.screenshot({ path: path.join(__dirname,'manha.png'), fullPage: true });
  await browser.close();
  console.log(`\n${r.filter(Boolean).length}/${r.length} verificacoes passaram`);
  process.exit(r.every(Boolean) ? 0 : 1);
})();
