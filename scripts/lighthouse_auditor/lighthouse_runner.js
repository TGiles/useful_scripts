const Crawler = require('simplecrawler');
const lighthouse = require('lighthouse');
const generateReport = require('lighthouse/lighthouse-core/report/report-generator');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const simpleCrawlerConfig = require('./config/simpleCrawler');

/**
 * Launches a headless instance of chrome and runs Lighthouse on that instance.
 *
 * @param {*} url A URL that the headless instance will navigate to
 * @param {*} opts Any options to pass into Chrome
 * @param {*} [config=null] Any special options passed to Lighthouse
 * @returns Lighthouse Result object (LHR)
 */
async function launchChromeAndRunLighthouseAsync(url, opts, config = null) {
    try {
    const chrome = await chromeLauncher.launch({
        chromeFlags: opts.chromeFlags
    });
    opts.port = chrome.port;
    const results = await lighthouse(url, opts, config);
    await chrome.kill();
    return results.lhr;

    } catch (e) {
        console.error(e);
    }
};

/**
 * Function to process the Lighthouse Result object(s)
 *
 * @param {[string]} urlList Lighthouse will run an audit for each URL in this list
 * @param {[{}]} opts Any options to pass into Chrome
 * @param {string} tempFilePath A path to store the resulting HTML files
 */
async function processReports(urlList, opts, tempFilePath) {
    try {
    for (i = 0; i < urlList.length; i++) {
            let currentUrl = urlList[i];
            await launchChromeAndRunLighthouseAsync(currentUrl, opts[0])
            .then(results => {
                    let processObj = {
                        "currentUrl": currentUrl,
                        "results": results,
                        "tempFilePath": tempFilePath,
                        "opts": opts[0]
                    };
                    processResults(processObj);
                })
                .catch((err) => {
                    console.error(err);
                    throw err;
                });
            await launchChromeAndRunLighthouseAsync(currentUrl, opts[1])
                .then(results => {
                    let processObj = {
                        "e": currentUrl,
                        "results": results,
                        "tempFilePath": tempFilePath,
                        "opts": opts[1]
                    };
                    processResults(processObj);
                })
                .catch(err => {
                    console.error(err);
                    throw err;
                });
        }
    } catch (e) {
        console.error(e);
    }
};

const processResults = (processObj) => {
    let currentUrl = processObj.currentUrl;
    let opts = processObj.opts;
    let tempFilePath = processObj.tempFilePath;
    let results = processObj.results;
    let splitUrl = processObj.currentUrl.split('//');
                let replacedUrl = splitUrl[1].replace(/\//g, "_");
                let report = generateReport.generateReportHtml(results);
                let filePath;
                if (opts.emulatedFormFactor && opts.emulatedFormFactor === 'desktop') {
                    filePath = path.join(tempFilePath, replacedUrl + '.desktop.report.html');
                } else {
        filePath = path.join(tempFilePath, replacedUrl + '.mobile.report.html');
                }
                // https://stackoverflow.com/questions/34811222/writefile-no-such-file-or-directory
                fs.writeFile(filePath, report, {
                    encoding: 'utf-8'
                }, (err) => {
                    if (err) throw err;
                    if (opts.emulatedFormFactor && opts.emulatedFormFactor === 'desktop') {
            console.log('Wrote desktop report: ', currentUrl)
                    } else {
            console.log('Wrote mobile report: ', currentUrl);
                    }

                });
            })
            .catch((err) => {
                throw err
            });
    }
};
/**
 * Helper function to queue up async promises.
 * Otherwise, Lighthouse is going to run a report on every URL in the URL list.
 * This will bog down the CPU.
 * @param {[function]} funcList A list of functions to be executed
 * @param {number} [limit=4] The number of parallel processes to execute the funcList
 * 
*/
const parallelLimit = async (funcList, limit = 4) => {
    let inFlight = new Set();
    return funcList.map(async (func, i) => {
        while (inFlight.size >= limit) {
            await Promise.race(inFlight);
        }
        inFlight.add(func);
        await func;
        inFlight.delete(func);
    });
};

const main = () => {
    let urlList = [];
    let domainRoot = new URL("https://tgiles.github.io");
    domainRoot = new URL('https://www.dylansheffer.com');
    urlList.push(domainRoot.href);
    let simpleCrawler = new Crawler(domainRoot.href)
        .on("queueadd", function (queueItem) {
            if (!queueItem.uriPath.match(
                /\.(css|jpg|pdf|docx|js|png|ico|gif|svg|psd|ai|zip|gz|zx|src|cassette|mini-profiler|axd|woff|woff2|)/i
            )) {
                urlList.push(queueItem.url);
                console.log("Pushed: ", queueItem.url);
            }
        })
        .on("complete", function () {
            // https://github.com/GoogleChrome/lighthouse/tree/master/lighthouse-core/config
            // for more information on config options for lighthouse
            let opts = {
                extends: 'lighthouse:default',
                chromeFlags: ['--headless'],
            };
            let desktopOpts = {
                extends: 'lighthouse:default',
                chromeFlags: ['--headless'],
                emulatedFormFactor: 'desktop'
            };
            let fileTime = new Date().toISOString();
            // Replacing characters that make Windows filesystem sad
            fileTime = fileTime.replace(/:/g, "_");
            fileTime = fileTime.replace(/\./g, "_");

            // tempFilePath is wherever we want to store the generated report
            let tempFilePath = path.join(__dirname, "lighthouse", fileTime);
            if (!fs.existsSync(tempFilePath)) {
                fs.mkdirSync(tempFilePath, { recursive: true });
            }
            // After crawling
            /* 
            async start function
            This prevents the CPU from getting bogged down when Lighthouse tries to run
            a report on every URL in the URL list
            */
            (async () => {
                const promises = await parallelLimit(
                    [
                        processReports(urlList, opts, fileTime, tempFilePath),
                        processReports(urlList, desktopOpts, fileTime, tempFilePath)
                    ],
                    2);
                await Promise.all(promises);
                console.log('done with all reports!');
            })();
        });
    for (key in simpleCrawlerConfig) {
        simpleCrawler[key] = simpleCrawlerConfig[key];
    }
    simpleCrawler.host = domainRoot.hostname;
    console.log('Starting simple crawler on', simpleCrawler.host + '!');
    simpleCrawler.start();
}
main();
