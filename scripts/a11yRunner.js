const {URL} = require('url');
const path = require('path');
const a11y = require('the-a11y-machine');
const fs = require('fs');
const yaml = require('js-yaml');

// I guess it's a pseudo programmatic way to call this npm package
// I'm sure there's a better way to do this, eventually.

/**
 * The main runner for the CLI of the a11y machine npm package.
 * 
 * 
 * 
 * @param {String} url  Used as the root domain for your accessibility testing.
 * @param {String} outputPath  Used to output the generated reports into a directory.
 */

function main(url, outputPath, configurationFile="./default_a11y.yml") {
    let urlObject = new URL(url);
    let time = new Date().toISOString();
    time = time.replace(/:/g, "_");
    time = time.replace(/\./g, "_");
    let reportName = path.join(urlObject.hostname, time);
    let outputDirectory = path.join(outputPath, reportName);
    console.log("Crawling through ", url);
    if(fs.existsSync(configurationFile)) {
        try {
            optionsFromConfigurationFile = yaml.safeLoad(
                fs.readFileSync(
                    configurationFile,
                    'utf8'
                )
            );
        }
        catch(err) {
            throw err;
        }
    }
    var opts = {
        outputDirectory: outputDirectory,
        maximumDepth: 0,
        maximumUrls: 256,
        bootstrap: undefined
    };
    return a11y.start(opts, [url]);
}
let url = "https://tgiles.github.io"; // Your URL here
let outputPath = "./a11ym_reports"; // Your output here

main(url, outputPath);