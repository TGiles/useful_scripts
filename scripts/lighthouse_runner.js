const Crawler = require('simplecrawler');
const lighthouse = require('lighthouse');
const generateReport = require('lighthouse/lighthouse-core/report/report-generator');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');
// Not sure why I have to import URL module this way, but (shrug)
const {
    URL
} = require('url');

async function launchChromeAndRunLighthouseAsync(url, opts, config = null) {
    const chrome = await chromeLauncher.launch({
        chromeFlags: opts.chromeFlags
    });
    opts.port = chrome.port;
    const results = await lighthouse(url, opts, config);
    await chrome.kill();
    return results.lhr;
};

async function processReports(urlList, opts, fileTime, tempFilePath) {
    for (i = 0; i < urlList.length; i++) {
        var e = urlList[i];
        await launchChromeAndRunLighthouseAsync(e, opts)
            .then(results => {
                var splitUrl = e.split('//');
                var replacedUrl = splitUrl[1].replace(/\//g, "_");
                var report = generateReport.generateReportHtml(results);
                // Default is to test against mobile form factor, therefore .mobile.report.html
                const filePath = path.join(tempFilePath, replacedUrl + ".mobile.report.html");
                // const filePath = path.join(__dirname, "TEST_FOLDER_AF", "lighthouse", fileTime, replacedUrl + ".mobile.report.html");
                // https://stackoverflow.com/questions/34811222/writefile-no-such-file-or-directory
                fs.writeFile(filePath, report, {
                    encoding: 'utf-8'
                }, (err) => {
                    if (err) throw err;
                    console.log('Wrote mobile report: ' + e);
                });
            })
            .catch((err) => {
                throw err
            });
    }
};
/*   
    This function allows us to queue up async promises.
    Otherwise, Lighthouse is going to try to run a report on every URL in the URL list...
    which is bad since 
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

function main() {
    var urlList = [];
    const domainRoot = new URL("http://tgiles.github.io");
    urlList.push(domainRoot.href);
    var simpleCrawler = new Crawler(domainRoot.href)
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
            var opts = {
                extends: 'lighthouse:default',
                chromeFlags: ['--headless'],
            };
            var desktopOpts = {
                extends: 'lighthouse:default',
                chromeFlags: ['--headless'],
                emulatedFormFactor: 'desktop'
            };
            var fileTime = new Date().toISOString();
            /* Replacing characters that make Windows filesystem sad */
            fileTime = fileTime.replace(/:/g, "_");
            fileTime = fileTime.replace(/\./g, "_");

            /* 
                tempFilePath is wherever we want to store the generated report
            */
            var tempFilePath = path.join(__dirname, "lighthouse", fileTime);
            if (!fs.existsSync(tempFilePath)) {
                fs.mkdirSync(tempFilePath,  {recursive: true});
            }
            /* After crawling   */
            /* async start function
                This prevents the CPU from getting bogged down when Lighthouse tries to run
                a report on every URL in the URL list
            */
            (async () => {
                const promises = await parallelLimit(
                    [processReports(urlList, opts, fileTime, tempFilePath)],
                    2);
                await Promise.all(promises);
                console.log('done with all reports!');
            })();
        });
    simpleCrawler.maxDepth = 0;
    simpleCrawler.host = domainRoot.hostname;
    simpleCrawler.filterByDomain = true;
    simpleCrawler.stripQuerystring = true;
    simpleCrawler.downloadUnsupported = false;
    simpleCrawler.maxConcurrency = 4;
    simpleCrawler.allowInitalDomainChange = true;
    simpleCrawler.respectRobotsTxt = true;
    simpleCrawler.parseHTMLComments = false;
    simpleCrawler.parseScriptTags = false;
    console.log('Starting simple crawler on', simpleCrawler.host, '!');
    simpleCrawler.start();
}
main();
