const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = process.argv[2];
  for (const [hash, scheme, name] of [['#dove', 'light', 'dove'], ['#spot-santa-marinella', 'light', 'spot-mare'], ['#spot-bracciano', 'dark', 'spot-lago'], ['#altro', 'light', 'altro'], ['#dove', 'dark', 'dove-scuro'], ['#pesci', 'light', 'pesci']]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 1 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto('file://' + process.cwd() + '/dist/preview.html' + hash);
    await p.waitForTimeout(700);
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    console.log(name, 'scrollWidth', w.join('/'), errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    await p.close();
  }
  await b.close();
})();
