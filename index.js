const puppeteer = require('puppeteer');
const fs = require('fs');

const {
  basename,
  resolve,
  relative
} = require('path');

const {
  readFileSync
} = require('fs');


async function printDiagram(page, options) {

  const {
    input,
    outputs,
    minDimensions,
    footer,
    title = true,
    deviceScaleFactor,
    element
  } = options;

  const diagramXML = readFileSync(input, 'utf8');

  const diagramTitle = title === false ? false : (
    title.length ? title : basename(input)
  );

  await page.goto(`file://${__dirname}/skeleton.html`);

  const viewerScript = relative(__dirname, require.resolve('bpmn-js/dist/bpmn-viewer.production.min.js'));

  const result = await page.evaluate(async function(diagramXML, options) {

    const {
      viewerScript,
      ...openOptions
    } = options;

    await loadScript(viewerScript);

    // returns desired viewport
    return openDiagram(diagramXML, openOptions);
  }, diagramXML, {
    minDimensions,
    title: diagramTitle,
    viewerScript,
    footer
  });

  console.log("--- result ---");
  console.log(result);

  const desiredViewport = result.desiredViewport;

  page.setViewport({
    width: Math.round(desiredViewport.width),
    height: Math.round(desiredViewport.height),
    deviceScaleFactor: deviceScaleFactor
  });

  await page.evaluate(() => {
    return resize();
  });

  if (typeof element === 'string') {
    console.log("=== zoom the element ===");
    console.log(element);
    await page.evaluate((element) => {
      zoomToElement(element);
    }, element);
    console.log("==== zoom done ===");  
  }

  for (const output of outputs) {

    console.log(`writing ${output}`);

    if (output.endsWith('.pdf')) {
      await page.pdf({
        path: output,
        width: desiredViewport.width,
        height: desiredViewport.diagramHeight
      });
    } else
    if (output.endsWith('.png')) {
      await page.screenshot({
        path: output,
        clip: {
          x: 0,
          y: 0,
          width: desiredViewport.width,
          height: desiredViewport.diagramHeight
        }
      });
    } else
    if (output.endsWith('.svg')) {

      const svg = await page.evaluate(() => {
        return toSVG();
      });

      fs.writeFileSync(output, svg, 'utf8');
    } else {
      console.error(`Unknown output file format: ${output}`);
    }
  }

}

async function withPage(fn) {
  let browser;

  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      devtools: false,
      headless: false
    });

    await fn(await browser.newPage());
  } finally {
    if (browser) {
      //await browser.close();
    }
  }
}


async function convertAll(conversions, options={}) {

  const {
    minDimensions,
    footer,
    title,
    deviceScaleFactor,
    element
  } = options;

  await withPage(async function(page) {

    for (const conversion of conversions) {

      const {
        input,
        outputs
      } = conversion;

      await printDiagram(page, {
        input,
        outputs,
        minDimensions,
        title,
        footer,
        deviceScaleFactor,
        element
      });
    }

  });

}

module.exports.convertAll = convertAll;

async function convert(input, output) {
  return await convertAll([
    {
      input,
      outputs: [ output ]
    }
  ]);
}


module.exports.convert = convert;
